import asyncio
import json
from pathlib import Path
from urllib.parse import unquote, urljoin

import httpx
from lxml import etree  # type: ignore[import]

BASE_URL = "https://endfield.wiki.gg"
HEADERS = {
    "user-agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36",
    "accept-encoding": "gzip",
}


# -----------------------------
# IMAGE HELPERS
# -----------------------------
async def download_image(client: httpx.AsyncClient, url: str, save_path: Path):
    if save_path.exists():
        return  # Skip existing
    resp = await client.get(url, headers=HEADERS)
    save_path.write_bytes(resp.content)
    print(f"[IMG] Saved {save_path}")


def normalize_item_image_url(src: str) -> str:
    if "/thumb/" not in src:
        return src
    parts = src.split("/thumb/")
    rest = parts[1]
    filename = rest.split("/")[0]
    query = ""
    if "?" in src:
        query = "?" + src.split("?")[1]
    return f"/images/{filename}{query}"


def extract_main_image(tree):
    """抓取 item 或 facility 主图"""
    img = tree.xpath('//figure[contains(@class,"pi-image")]//img/@src')
    return img[0] if img else None


def extract_item_images(tree):
    return tree.xpath('//div[@class="item-tooltip"]//img/@src')


# -----------------------------
# INFO PARSER
# -----------------------------
def get_general_info(tree):
    info = {}
    data_items = tree.xpath(
        '//section[h2[text()="General Information"]]//div[contains(@class, "pi-data")]'
    )
    for item in data_items:
        label_el = item.xpath('./h3[contains(@class, "pi-data-label")]')
        label = label_el[0].text.strip() if label_el else None
        value_elements = item.xpath('./div[contains(@class, "pi-data-value")]')
        if value_elements:
            value = " ".join(value_elements[0].xpath(".//text()")).strip()
        else:
            value = None
        if label and value:
            info[label] = value
    return info


# -----------------------------
# FETCH FACILITIES
# -----------------------------
async def get_facilities(client: httpx.AsyncClient) -> list[str]:
    resp = await client.get(
        f"{BASE_URL}/api.php?action=parse&page=EFDB&format=json",
        headers=HEADERS,
    )
    html = resp.json()["parse"]["text"]["*"]
    tree = etree.HTML(html)

    facilities = set()
    processing_links = tree.xpath(
        "//div[./div/text()='Processing']/following-sibling::div[@class='ranger-listbox']//a[@title]"
    )
    for link in processing_links:
        title = link.get("title")
        facilities.add(title)
    assembly_links = tree.xpath(
        "//div[./div/text()='Assembly']/following-sibling::div[@class='ranger-listbox']//a[@title]"
    )
    for link in assembly_links:
        title = link.get("title")
        facilities.add(title)
    return list(facilities)


def get_recipes(tree):
    recipes = []
    recipe_rows_xpath = '(//table[@class="mrfz-wtable"])[1]/tbody/tr[position() > 1]'
    recipe_rows = tree.xpath(recipe_rows_xpath)

    for row in recipe_rows:
        input_materials = []
        input_name_elements = row.xpath("./td[1]//div[@class='item-tooltip']")
        input_count_elements = row.xpath("./td[1]//div[@class='item-count']")
        if not input_name_elements:
            continue
        for name_el, count_el in zip(input_name_elements, input_count_elements):
            input_materials.append(
                {
                    "name": name_el.get("data-name"),
                    "quantity": int(count_el.text.strip()),
                }
            )

        output_name_elements = row.xpath("./td[2]//div[@class='item-tooltip']")
        output_count_elements = row.xpath("./td[2]//div[@class='item-count']")
        if not output_name_elements:
            continue
        output_product = {
            "name": output_name_elements[0].get("data-name"),
            "quantity": int(output_count_elements[0].text.strip()),
        }

        time_el = row.xpath("./td[3]")
        if not time_el:
            continue
        time = time_el[0].text.strip()

        recipes.append(
            {
                "inputs": input_materials,
                "outputs": [output_product],
                "time": time,
            }
        )

    return recipes


# -----------------------------
# FETCH FACILITY PAGE
# -----------------------------
async def get_facility_and_recipes(client: httpx.AsyncClient, facility_name: str):
    resp = await client.get(
        f"{BASE_URL}/api.php?action=parse&page={facility_name.replace(' ', '_')}&format=json",
        headers=HEADERS,
    )
    html = resp.json()["parse"]["text"]["*"]
    tree = etree.HTML(html)
    facility_image = extract_main_image(tree)
    item_images = extract_item_images(tree)
    general_info = get_general_info(tree)
    recipes = get_recipes(tree)
    return tree, facility_image, item_images, general_info, recipes


# -----------------------------
# FETCH ITEM PAGE
# -----------------------------
async def get_item_info_page(client: httpx.AsyncClient, item_name: str):
    resp = await client.get(
        f"{BASE_URL}/api.php?action=parse&page={item_name.replace(' ', '_')}&format=json",
        headers=HEADERS,
    )
    html = resp.json()["parse"]["text"]["*"]
    tree = etree.HTML(html)

    image_src = extract_main_image(tree)
    general_info = get_general_info(tree)
    return image_src, general_info


# -----------------------------
# MAIN RUN
# -----------------------------
async def run():
    Path("export/images/items").mkdir(parents=True, exist_ok=True)
    Path("export/images/facilities").mkdir(parents=True, exist_ok=True)

    async with httpx.AsyncClient() as client:
        # -------- PHASE 1: fetch facilities --------
        facility_names = await get_facilities(client)
        tasks = [get_facility_and_recipes(client, name) for name in facility_names]
        results = await asyncio.gather(*tasks)

    items = {}
    facilities = {}
    recipes = {}
    img_jobs = []

    # -------- PHASE 2: parse facilities & recipes --------
    for facility_name, (
        tree,
        facility_img_src,
        item_img_srcs,
        general_info,
        facility_recipes,
    ) in zip(facility_names, results):
        facility_id = facility_name.replace(" ", "_")
        power = general_info.get("Power", 0)
        tier = general_info.get("Tier")

        # 设施图片
        if facility_img_src:
            full_url = urljoin(BASE_URL, facility_img_src)
            save_path = Path(f"export/images/facilities/{facility_id}.png")
            img_jobs.append((full_url, save_path))

        facilities[facility_id] = {
            "id": facility_id,
            "name": facility_name,
            "tier": tier,
            "powerConsumption": power,
            "supportedRecipes": [],
            "image": f"images/facilities/{facility_id}.png"
            if facility_img_src
            else None,
        }

        # items in recipes
        for r in facility_recipes:
            for inp in r["inputs"]:
                item_id = inp["name"].replace(" ", "_")
                items.setdefault(
                    item_id,
                    {
                        "id": item_id,
                        "name": {"en": inp["name"]},
                        "image": None,
                        "tier": None,
                    },
                )
            for out in r["outputs"]:
                item_id = out["name"].replace(" ", "_")
                items.setdefault(
                    item_id,
                    {
                        "id": item_id,
                        "name": {"en": out["name"]},
                        "image": None,
                        "tier": None,
                    },
                )

        # ---- 生成唯一 recipe_id ----
        recipe_count = {}
        for r in facility_recipes:
            first_out_id = r["outputs"][0]["name"].replace(" ", "_")
            seq = recipe_count.get(first_out_id, 0) + 1
            recipe_count[first_out_id] = seq
            recipe_id = f"{facility_id}__{first_out_id}__{seq}"

            recipes[recipe_id] = {
                "id": recipe_id,
                "facilityId": facility_id,
                "inputs": [
                    {"itemId": inp["name"].replace(" ", "_"), "amount": inp["quantity"]}
                    for inp in r["inputs"]
                ],
                "outputs": [
                    {"itemId": o["name"].replace(" ", "_"), "amount": o["quantity"]}
                    for o in r["outputs"]
                ],
                "craftingTime": r["time"],
            }
            facilities[facility_id]["supportedRecipes"].append(recipe_id)

        # recipe item images
        for src in item_img_srcs:
            full_src = normalize_item_image_url(src)
            full_url = urljoin(BASE_URL, full_src)
            filename = full_src.split("/")[-1].split("?")[0]
            filename = unquote(filename)
            img_path = Path(f"export/images/items/{filename}")
            img_jobs.append((full_url, img_path))
            item_id = Path(filename).stem.replace(" ", "_")
            if item_id in items:
                items[item_id]["image"] = f"images/items/{filename}"

    # -------- PHASE 3: fetch items page info --------
    async with httpx.AsyncClient() as client:
        item_names = [item["name"]["en"] for item in items.values()]
        tasks = [get_item_info_page(client, name) for name in item_names]
        results = await asyncio.gather(*tasks)

    for item, (image_src, general_info) in zip(items.values(), results):
        tier = general_info.get("Tier")
        if tier:
            item["tier"] = tier
        # 主图覆盖 recipe 图
        if image_src:
            full_url = urljoin(BASE_URL, image_src)
            filename = image_src.split("/")[-1].split("?")[0]
            filename = unquote(filename)
            img_path = Path(f"export/images/items/{filename}")
            img_jobs.append((full_url, img_path))
            item["image"] = f"images/items/{filename}"

    # -------- PHASE 4: download images --------
    async with httpx.AsyncClient() as client:
        await asyncio.gather(
            *[download_image(client, url, save_path) for url, save_path in img_jobs]
        )

    # -------- PHASE 5: save JSON --------
    Path("export").mkdir(exist_ok=True)
    with open("export/items.json", "w", encoding="utf8") as f:
        json.dump(list(items.values()), f, ensure_ascii=False, indent=2)
    with open("export/facilities.json", "w", encoding="utf8") as f:
        json.dump(list(facilities.values()), f, ensure_ascii=False, indent=2)
    with open("export/recipes.json", "w", encoding="utf8") as f:
        json.dump(list(recipes.values()), f, ensure_ascii=False, indent=2)

    print("Export completed: items.json / facilities.json / recipes.json + images")


if __name__ == "__main__":
    asyncio.run(run())
