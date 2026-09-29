# IPO Manager — Backend

Spring Boot 3.2 backend for the **IPO Manager** app: track who sent how much
for which IPO, by what method, what happened to it (allotted / refunded),
and what you still owe them — with encrypted KYC storage, a settlement
workflow, and one-tap WhatsApp reports.

- **Stack:** Java 17 · Spring Boot 3.2 · Spring Data JPA · H2 (file-based) ·
  Bean Validation · Maven
- **No auth** — single-user app, keep it on your private network / Tailscale.

## Prerequisites

- Java 17+ (`java -version`)
- Maven 3.6+ (`mvn -version`)
- `openssl` (for generating the encryption key)

## 1. Generate the encryption key (required)

KYC fields (PAN, email, login id, password, MPIN) are encrypted at rest with
AES-256-GCM. The app **refuses to start** without a key:

```bash
openssl rand -base64 32
```

Copy the output and export it before every run:

```bash
export KYC_ENCRYPTION_KEY='<paste-output-here>'
```

The value must be base64 decoding to exactly 32 bytes. Never commit it.

## 2. Run with Maven

```bash
cd backend
export KYC_ENCRYPTION_KEY='<your-key>'
mvn spring-boot:run
```

The API is then available at `http://localhost:8080/api/...`.
The H2 database file is created at `./data/ipomanager.mv.db` (relative to
where you launch the app).

To build the jar:

```bash
mvn -DskipTests package
java -jar target/ipo-manager-0.1.0.jar   # with KYC_ENCRYPTION_KEY exported
```

## 3. CORS configuration

Allowed origins come from `app.cors.allowed-origins` (comma-separated,
default `http://localhost:5173` for Vite dev).

For production with the frontend on **GitHub Pages**, set it to your Pages
origin, e.g. via an environment-style property override:

```bash
java -Dapp.cors.allowed-origins=https://<your-username>.github.io \
     -jar target/ipo-manager-0.1.0.jar
```

or add the line to `src/main/resources/application.properties`:

```properties
app.cors.allowed-origins=https://<your-username>.github.io
```

## 4. Docker

```bash
# Build (from the backend/ directory)
docker build -t ipo-manager-backend .

# Run — key via env var, data persisted in a named volume
docker run -d --name ipo-manager \
  -p 8080:8080 \
  -v ipo-data:/app/data \
  -e KYC_ENCRYPTION_KEY='<your-key>' \
  ipo-manager-backend
```

The image is based on `eclipse-temurin:17-jre`. The H2 file lives in
`/app/data` inside the container.

## 5. API overview

| Method | Path | Description |
|---|---|---|
| GET/POST | `/api/people` | List / create people |
| GET/PUT/DELETE | `/api/people/{id}` | Read / update / delete a person |
| GET | `/api/people/{id}/kyc` | KYC, masked by default (`ABCDE••••F`, `p•••@gmail.com`) |
| GET | `/api/people/{id}/kyc?reveal=true` | Full KYC values — writes an audit log line |
| PUT | `/api/people/{id}/kyc` | Upsert KYC (only non-null fields overwrite) |
| GET | `/api/people/{id}/report?ipoId=` | Per-IPO rows + totals (Report Drawer data) |
| GET/POST | `/api/ipos` | List / create IPOs |
| GET/PUT/DELETE | `/api/ipos/{id}` | Read / update / delete an IPO |
| GET/POST | `/api/transactions` | List / record a transaction |
| GET/PUT/DELETE | `/api/transactions/{id}` | Read / update / delete |
| PATCH | `/api/transactions/{id}/settle` | Mark settled (`settled=true`, `settledAt=now`) |
| GET/POST | `/api/applications` | List / create applications |
| GET/PUT/DELETE | `/api/applications/{id}` | Read / update / delete |
| PATCH | `/api/applications/{id}/status` | `{status}` — sets `allottedBy="You"`, `allottedAt=now` for ALLOTTED/NOT_ALLOTTED |
| POST | `/api/reports/send` | `{personId, ipoId?}` → server-built message + `wa.me` link, persists a `ReportLog` |
| GET | `/api/dashboard/stats` | Stat cards (see below) |

Enums: `IpoStatus` = UPCOMING/OPEN/CLOSED/LISTED ·
`TxnDirection` = RECEIVED/SENT · `TxnMode` = UPI/GPAY/CASH/BANK/SELF ·
`ApplicationStatus` = APPLIED/ALLOTTED/NOT_ALLOTTED/REFUNDED.

### Dashboard stats (`GET /api/dashboard/stats`)

```json
{
  "activeIpos": 2,
  "totalReceived": 45000.00,
  "peopleCount": 6,
  "pendingToCollect": 15000.00,
  "pendingSettlements": { "count": 1, "total": 15000.00 },
  "allotmentRateYtd": 0.67
}
```

- `activeIpos` — IPOs with status `OPEN`
- `pendingToCollect` — total RECEIVED − total SENT
- `pendingSettlements` — RECEIVED transactions with `settled=false` on
  CLOSED/LISTED IPOs (count + sum)
- `allotmentRateYtd` — ALLOTTED ÷ total applications created this year
  (0.0–1.0, `0` when there are none)

### Send report (`POST /api/reports/send`)

No SMS gateway is configured, so the response hands you a pre-filled
WhatsApp link to send yourself:

```json
{
  "status": "manual",
  "waLink": "https://wa.me/919876543210?text=Hi%20Rahul...",
  "message": "Hi Rahul, your Tata Capital IPO summary:\n..."
}
```

Phone normalization: non-digits stripped; a bare 10-digit number gets the
`91` country code prefixed. A `ReportLog` row (`channel=whatsapp`,
`status=manual`) is persisted every time.

## 6. Project layout

```
src/main/java/com/ipomanager/
├── IpoManagerApplication.java
├── config/        # EncryptionKeyConfig (fail-fast), CorsConfig
├── security/      # AesGcmCrypto (AES-256-GCM), EncryptedStringConverter (JPA)
├── model/         # Person, Ipo, Transaction, Application, PersonKyc, ReportLog + enums
├── repository/    # Spring Data JPA repositories + sum/settlement queries
├── dto/           # Request/response shapes (KYC masked view, report, stats…)
├── service/       # KycService (masking + reveal audit), ReportService, DashboardService
├── controller/    # REST controllers
├── exception/     # ResourceNotFoundException, JSON error handler
└── util/          # Inr (Indian ₹ number formatting)
```

## 7. Security notes (from the spec)

- KYC secrets are AES-256-GCM encrypted at rest; entities stay unaware via
  a JPA `AttributeConverter`. Hibernate SQL logging is off so values never
  hit logs; the reveal endpoint logs only *who/what/when*, never values.
- Storing someone else's **broker password / MPIN** is high-risk — those
  fields are opt-in; the recommendation is to leave them empty and use a
  real password manager.
- If you move off H2 to Postgres/MySQL later, encrypt your backup dumps
  too — DB encryption doesn't cover a plaintext `.sql` file.
- Single-user assumption: add real auth before anyone else gets access.
