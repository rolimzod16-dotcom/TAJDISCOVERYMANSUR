import json

# All tours use price 0 = "Price upon request" (enforced in server/app.js too)
PRICES = {tid: 0 for tid in range(11, 21)}

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