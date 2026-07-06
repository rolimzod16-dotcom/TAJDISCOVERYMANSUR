import glob
import re

REPLACEMENTS = [
    # index homepage tour cards
    (
        'children:["$",Number(v.price).toLocaleString()]',
        'children:[window.__tdTourPriceDisplay(v.price)]',
    ),
    # tour-detail - multiple variants
    (
        'children:["$",Number(t.price).toLocaleString(),e.jsx("span",{className:"text-xs text-[hsl(218,25%,55%)] font-sans ml-1",children:"/person"})]',
        'children:[window.__tdTourPriceDisplay(t.price)]',
    ),
    (
        'children:["$",Number(t.price).toLocaleString(),e.jsx("span",{className:"text-sm text-white/50 font-sans ml-1",children:"/person"})]',
        'children:[window.__tdTourPriceDisplay(t.price)]',
    ),
    (
        'children:["$",Number(t.price).toLocaleString(),e.jsx("span",{className:"text-base text-white/50 font-sans ml-1",children:"/person"})]',
        'children:[window.__tdTourPriceDisplay(t.price)]',
    ),
    (
        'children:["$",i.price.toLocaleString()]',
        'children:[window.__tdTourPriceDisplay(i.price)]',
    ),
    (
        'children:["$",s.price.toLocaleString()]',
        'children:[window.__tdTourPriceDisplay(s.price)]',
    ),
    (
        'children:["$",Number(s.price).toLocaleString()]',
        'children:[window.__tdTourPriceDisplay(s.price)]',
    ),
]

files = [
    r"C:\Users\user\tajdiscovery\public\assets\index-BtlhPY74.js",
    r"C:\Users\user\tajdiscovery\public\assets\tour-detail-DREO-KrN.js",
]

for path in files:
    text = open(path, encoding="utf-8").read()
    original = text
    for old, new in REPLACEMENTS:
        if old in text:
            text = text.replace(old, new)
            print(f"patched in {path}: {old[:60]}...")
        else:
            print(f"MISSING in {path}: {old[:60]}...")
    if text != original:
        open(path, "w", encoding="utf-8").write(text)
        print(f"saved {path}")
    else:
        print(f"no changes {path}")