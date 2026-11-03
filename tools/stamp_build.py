"""Run before zipping/deploying:  python3 tools/stamp_build.py
Writes the website build id into public/data/changelog.json so the bot can show an automatic
"Minor website update" line whenever the site changed but no entry was written."""
import hashlib, json, os
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
h = hashlib.sha1()
for base in ("src", "public"):
    for d, _, files in sorted(os.walk(os.path.join(root, base))):
        for f in sorted(files):
            p = os.path.join(d, f)
            if p.endswith("changelog.json") or "__pycache__" in p:
                continue
            h.update(p.encode() + open(p, "rb").read())
path = os.path.join(root, "public", "data", "changelog.json")
data = json.load(open(path))
data["build"] = h.hexdigest()[:10]
json.dump(data, open(path, "w"), indent=1, ensure_ascii=False)
print("build", data["build"])
