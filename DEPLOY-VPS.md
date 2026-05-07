# Prime Advertere VPS Deployment

This site can live on the same VPS as `quantumwealthai.com` while staying completely separate from it.

## Separation Model

Keep the two businesses isolated by separating all of the following:

- code directories
- Node processes
- environment files
- Nginx server blocks
- TLS certificates
- deploy users or app folders if you want extra hard separation

Recommended layout on the VPS:

```text
/var/www/quantumwealthai
/var/www/primeadvertere
```

Prime Advertere should run as its own Node app on its own local port, for example `127.0.0.1:3010`, with Nginx routing `primeadvertere.com` and `www.primeadvertere.com` to that process.

## 1. Copy The Site To The VPS

Clone or upload this project into its own folder:

```bash
git clone <your-prime-advertere-repo> /var/www/primeadvertere
cd /var/www/primeadvertere
npm install
```

## 2. Create The Environment File

Create `.env` in the app root:

```env
PORT=3010
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
BOOKING_EMAIL_TO=start@primeadvertere.com
MAIL_DEBUG=false
```

The booking handlers also accept these aliases if your host already uses them:

- `SMTP_PASSWORD` instead of `SMTP_PASS`
- `EMAIL_TO` or `CONTACT_EMAIL_TO` instead of `BOOKING_EMAIL_TO`

Important:

- use a different `.env` file than the one for `quantumwealthai.com`
- do not reuse app folders between businesses
- confirm your SMTP credentials are valid before switching DNS

## 3. Start The App With PM2

This repo includes `ecosystem.config.js`.

From the app folder:

```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

Health check:

```bash
curl http://127.0.0.1:3010/health
```

Expected result:

```json
{"ok":true}
```

## 4. Add A Separate Nginx Site

Use the sample config in `deploy/nginx/primeadvertere.com.conf`.

Typical symlink flow:

```bash
sudo cp deploy/nginx/primeadvertere.com.conf /etc/nginx/sites-available/primeadvertere.com
sudo ln -s /etc/nginx/sites-available/primeadvertere.com /etc/nginx/sites-enabled/primeadvertere.com
sudo nginx -t
sudo systemctl reload nginx
```

This config only proxies `primeadvertere.com` traffic to the Prime Advertere app and does not touch the Quantum Wealth AI server block.

## 5. Add SSL

After DNS points to the VPS:

```bash
sudo certbot --nginx -d primeadvertere.com -d www.primeadvertere.com
```

## 6. Switch DNS

At your DNS provider:

- point `primeadvertere.com` to the VPS public IP
- point `www.primeadvertere.com` to the same VPS public IP or a CNAME that resolves there
- leave `quantumwealthai.com` records unchanged

If Netlify is currently serving the live domain, remove or replace the old Netlify DNS records only for `primeadvertere.com`.

## 7. Smoke Test Checklist

- `https://primeadvertere.com` loads
- `https://www.primeadvertere.com` redirects or loads correctly
- `https://primeadvertere.com/health` returns `{"ok":true}`
- homepage booking form submits
- blog subscribe form submits
- `order/` flow submits
- `premium/` flow submits
- confirmation emails arrive

## Useful Commands

```bash
pm2 status
pm2 logs prime-advertere
pm2 restart prime-advertere
sudo nginx -t
sudo systemctl reload nginx
```

## Notes About This App

- `server.js` serves the static site and handles all live form routes under `/api/*`
- the homepage booking form will try the old Netlify function first, then fall back to `/api/book-demo`
- once the VPS version is confirmed live, you can simplify that frontend behavior later if you want
