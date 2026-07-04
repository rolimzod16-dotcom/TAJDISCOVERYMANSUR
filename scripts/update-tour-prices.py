import json

# Prices synced from tajadventures.com (starting price / listing, Jul 2026)
# 0 = "Price upon request" on tajadventures.com
PRICES = {
    11: 0,    # Trans Pamirs Osh→Dushanbe — no matching priced tour on tajadventures.com
    12: 884,  # Pamir Highway & Sarez Lake → /tours/3/trekking-to-the-lake-sarez/
    13: 0,    # Fann Adventure → /tours/21/trekking-in-the-lakes-of-the-fann-mountains/
    14: 0,    # Dushanbe Samarqand → /tours/27/dushanbe-samarqand-tour/
    15: 0,    # Jizew Trekking → /tours/23/jizew-trekking-tour-2023-2024/
    16: 0,    # Jeep Tour Fann Mountains → /tours/25/jeep-tour-to-fann-mountains/
    17: 0,    # Dushanbe City Tour → /tours/22/dushanbe-city-tour/
    18: 0,    # Khatlon & Sughd → /tours/17/jeep-tour-to-khatlon-and-sughd/
    19: 0,    # Bartang & Wakhan → /tours/18/jeep-trekking/
    20: 0,    # Khatlon & Sughd (duplicate) → /tours/17/jeep-tour-to-khatlon-and-sughd/
}

path = r"C:\Users\user\tajdiscovery\data\db.json"
with open(path, encoding="utf-8") as f:
    db = json.load(f)

for tour in db["tours"]:
    tid = tour["id"]
    if tid in PRICES:
        old = tour["price"]
        tour["price"] = PRICES[tid]
        print(f"Tour {tid}: {old} -> {tour['price']}")

with open(path, "w", encoding="utf-8") as f:
    json.dump(db, f, ensure_ascii=False, indent=2)
    f.write("\n")

print("done")