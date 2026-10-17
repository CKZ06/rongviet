import os

site_dir = 'dino4vn.com'
count = 0
for root, dirs, files in os.walk(site_dir):
    for f in files:
        if f.endswith('.html') or f.endswith('.htm'):
            p = os.path.join(root, f)
            with open(p, 'r', encoding='utf-8', errors='ignore') as fl:
                content = fl.read()
            new_content = content
            new_content = new_content.replace('app.20261013.236cfccd.js?v=2', 'app.20261013.236cfccd.js?v=3')
            new_content = new_content.replace('app.20261013.236cfccd.js"', 'app.20261013.236cfccd.js?v=3"')
            if new_content != content:
                with open(p, 'w', encoding='utf-8') as fl:
                    fl.write(new_content)
                count += 1

print(f"Updated cache bust query params in {count} files")
