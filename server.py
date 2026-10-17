import http.server
import socketserver
import urllib.request
import json
import os
import sys
import threading
import time
import datetime

# Configure utf-8 encoding for stdout/stderr if available
try:
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8')
    if hasattr(sys.stderr, 'reconfigure'):
        sys.stderr.reconfigure(encoding='utf-8')
except Exception:
    pass

PORT = 3000
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
SITE_DIR = os.path.join(BASE_DIR, "dino4vn.com")
DEST_API = os.path.join(SITE_DIR, "api")
os.makedirs(DEST_API, exist_ok=True)

headers = {'User-Agent': 'Mozilla/5.0'}

default_species = {
    'Tyrannosaurus': 15,
    'Troodon': 10,
    'Spino': 9,
    'Giga': 6,
    'Deinosuchus': 4,
    'Triceratops': 4,
    'Pteranodon': 3,
    'Dilophosaurus': 3,
    'Allosaurus': 2,
    'Carnotaurus': 2,
    'Ceratosaurus': 2,
    'Stegosaurus': 1
}

def sync_api_data():
    try:
        # 1. Fetch live status
        try:
            req_status = urllib.request.Request('https://rongviet.sequencemods.com/api/status', headers=headers)
            status_raw = json.loads(urllib.request.urlopen(req_status, timeout=8).read().decode('utf-8'))
        except Exception as e:
            print("[SYNC] Status error:", e)
            status_raw = {"ok": True, "server": "Rong Viet", "online": True}

        # 2. Fetch killfeed
        species_counts = {}
        try:
            req_kf = urllib.request.Request('https://rongviet.sequencemods.com/api/killfeed?limit=50', headers=headers)
            kf_data = json.loads(urllib.request.urlopen(req_kf, timeout=8).read().decode('utf-8'))
            for r in kf_data.get('rows', []):
                v = r.get('victim_species')
                k = r.get('killer_species')
                if v and v not in ['Deer', 'Boar', 'Rabbit', 'Goat', 'Frog', 'Fish', '']:
                    species_counts[v] = species_counts.get(v, 0) + 1
                if k and k not in ['Deer', 'Boar', 'Rabbit', 'Goat', 'Frog', 'Fish', '']:
                    species_counts[k] = species_counts.get(k, 0) + 1
        except Exception as e:
            print("[SYNC] Killfeed error:", e)

        species_live = species_counts if species_counts else default_species
        top_species = sorted(species_live.items(), key=lambda x: x[1], reverse=True)

        calculated_players = sum(species_live.values())
        if calculated_players > 200:
            calculated_players = 200

        status_payload = {
            "ok": True,
            "name": "[VN] Rồng Việt",
            "server": "Rong Viet",
            "server_display": "[VN] Rồng Việt",
            "online": True,
            "players": status_raw.get('players') if isinstance(status_raw.get('players'), int) else calculated_players,
            "maxPlayers": status_raw.get('max_players', 200),
            "max_players": status_raw.get('max_players', 200),
            "queueLength": 0,
            "map": "Gateway",
            "updatedAt": datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
            "speciesLive": dict(top_species),
            "top_species": [s[0] for s in top_species[:8]],
            "uptime_human": status_raw.get("uptime_human", "6h 15m"),
            "heartbeat_age_seconds": status_raw.get("heartbeat_age_seconds", 3)
        }

        # 3. Fetch live boards
        try:
            req_7d = urllib.request.Request('https://rongviet.sequencemods.com/api/boards?metric=kills&window=7d', headers=headers)
            data_7d = json.loads(urllib.request.urlopen(req_7d, timeout=8).read().decode('utf-8'))
            rows_7d = data_7d.get('boards', [{}])[0].get('rows', [])
        except Exception as e:
            print("[SYNC] 7d boards error:", e)
            rows_7d = []

        try:
            req_30d = urllib.request.Request('https://rongviet.sequencemods.com/api/boards?metric=points&window=30d', headers=headers)
            data_30d = json.loads(urllib.request.urlopen(req_30d, timeout=8).read().decode('utf-8'))
            rows_30d = data_30d.get('boards', [{}])[0].get('rows', [])
        except Exception as e:
            print("[SYNC] 30d boards error:", e)
            rows_30d = []

        def map_rows(raw_rows):
            out = []
            species_pool = [s[0] for s in top_species] if top_species else list(default_species.keys())
            for idx, r in enumerate(raw_rows):
                detail = r.get('detail', {})
                kills = detail.get('kills', r.get('score', 0))
                deaths = detail.get('deaths', 0)
                phut = max(45, (kills * 35) + 60 - (deaths * 5))
                km = round(phut * 0.12, 1)
                score = (kills * 100) + phut
                loai = species_pool[idx % len(species_pool)]
                
                out.append({
                    "hang": r.get('rank', idx + 1),
                    "ten": r.get('name', f"Player #{idx+1}"),
                    "loai": loai,
                    "phut": int(phut),
                    "km": km,
                    "adult": max(1, kills // 2),
                    "diem": int(score)
                })
            return out

        hom_nay = map_rows(rows_7d)
        thang_nay = map_rows(rows_30d if rows_30d else rows_7d)
        today_str = datetime.date.today().strftime("%Y-%m-%d")

        bxh_data = {
            "ngayVN": today_str,
            "homNay": hom_nay,
            "thangNay": thang_nay,
            "kyLucNgay": {
                "songLau": hom_nay[0] if hom_nay else {"ten": "Chưa ai", "phut": 0, "loai": "—"},
                "diXa": hom_nay[1] if len(hom_nay) > 1 else {"ten": "Chưa ai", "km": 0, "loai": "—"},
                "nuoiLon": hom_nay[2] if len(hom_nay) > 2 else {"ten": "Chưa ai", "adult": 0}
            },
            "coef": {
                "phut": 1.0,
                "km": 1.0,
                "adult": 500
            },
            "adultToiDaNgay": 2,
            "kmDangDo": False,
            "builtAt": int(datetime.datetime.now().timestamp()),
            "sampleIntervalS": 600,
            "doTuNgay": "2026-10-01"
        }

        with open(os.path.join(DEST_API, "bang-xep-hang.json"), "w", encoding="utf-8") as f:
            json.dump(bxh_data, f, ensure_ascii=False, indent=2)

        with open(os.path.join(DEST_API, "status.json"), "w", encoding="utf-8") as f:
            json.dump(status_payload, f, ensure_ascii=False, indent=2)

        now_str = datetime.datetime.now().strftime("%H:%M:%S")
        print(f"[{now_str}] Sync thanh cong: {status_payload['players']}/200 online.")
    except Exception as e:
        print("[SYNC] Loi dong bo:", e)

def background_sync_worker():
    while True:
        time.sleep(30)
        sync_api_data()

class RobustHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=SITE_DIR, **kwargs)

    def do_GET(self):
        # 1. Normalize path if user visits /dino4vn.com/...
        if self.path.startswith("/dino4vn.com"):
            new_path = self.path[len("/dino4vn.com"):] or "/"
            self.send_response(301)
            self.send_header("Location", new_path)
            self.end_headers()
            return

        # 2. Mock specific player / event endpoints if missing
        if self.path.startswith("/api/player/me"):
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(b'{"ok": false, "logged_in": false, "guest": true, "name": "Guest"}')
            return

        if self.path.startswith("/api/su-kien.json"):
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(b'{"schema": 1, "ts": 0, "lich": null}')
            return

        if self.path.startswith("/api/vay-trum.json"):
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(b'{"schema": 1, "ts": 0, "dang": false, "gan_nhat": null, "truoc": null, "luat": null, "sap": null}')
            return

        if self.path.startswith("/api/su-kien-gan-day.json"):
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(b'{"v": 1, "ts": 0, "su_kien": null}')
            return

        super().do_GET()

    def end_headers(self):
        # Never cache API responses
        if self.path.startswith("/api/"):
            self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
            self.send_header("Access-Control-Allow-Origin", "*")
        super().end_headers()

    def log_message(self, format, *args):
        # Suppress spamming log requests for assets/poller
        pass

if __name__ == "__main__":
    print("Khoi tao dong bo API...")
    sync_api_data()

    # Start background polling thread (every 30s)
    sync_thread = threading.Thread(target=background_sync_worker, daemon=True)
    sync_thread.start()

    # Start HTTP server
    class ReuseServer(socketserver.TCPServer):
        allow_reuse_address = True

    try:
        with ReuseServer(("", PORT), RobustHandler) as httpd:
            print("=" * 60)
            print(f"Server Rong Viet dang chay tai: http://localhost:{PORT}")
            print(f"Tu dong dong bo API truc tiep tu Rong Viet moi 30s")
            print("=" * 60)
            httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nDa dung server.")
        sys.exit(0)
