# 🚀 Deployment Setup Guide

এই গাইড অনুসরণ করে আপনার VPS তে automated deployment setup করুন।

---

## **পূর্বশর্ত**

- একটি Linux VPS (Ubuntu সুপারিশকৃত)
- SSH access সহ root বা sudo user
- Node.js 18+ installed
- Git installed

---

## **ধাপ ১: VPS এ Repository Clone করুন**

```bash
# ১. Directory তৈরি করুন
sudo mkdir -p /var/www/streaming-system
sudo chown $USER:$USER /var/www/streaming-system
cd /var/www/streaming-system

# २. Repository clone করুন
git clone git@github.com:mdrifathossain1999/24-7-Live-Streaming-Management-System.git .

# ३. Dependencies install করুন
npm install --omit=dev

# ४. Build করুন
npm run build
```

---

## **ধাপ २: SSH Key Setup করুন**

### A. যদি SSH key না থাকে:

```bash
# SSH key generate করুন
ssh-keygen -t rsa -b 4096 -f ~/.ssh/id_rsa -N ""

# Public key দেখুন
cat ~/.ssh/id_rsa.pub
```

### B. GitHub এ Public Key Add করুন:

1. যান: https://github.com/settings/keys
2. **New SSH key** ক্লিক করুন
3. উপরের output পুরো copy করে paste করুন
4. **Add SSH key** করুন

### C. Private Key Content দেখুন:

```bash
cat ~/.ssh/id_rsa
```

---

## **ধাপ ३: GitHub Secrets Setup করুন**

যান: https://github.com/mdrifathossain1999/24-7-Live-Streaming-Management-System/settings/secrets/actions

**"New repository secret" ক্লিক করুন এবং এই ४টি secret add করুন:**

| Secret Name | Value |
|---|---|
| `VPS_HOST` | আপনার VPS এর IP address বা domain |
| `VPS_USER` | VPS login username (ubuntu, root, etc.) |
| `VPS_SSH_KEY` | আপনার private SSH key এর সম্পূর্ণ content |
| `VPS_PORT` | SSH port (সাধারণত 22) |

### উদাহরণ:

**VPS_HOST এ দিন:**
```
192.168.1.100
```
অথবা
```
your-domain.com
```

**VPS_USER এ দিন:**
```
ubuntu
```

**VPS_SSH_KEY এ দিন:** (সম্পূর্ণ file content)
```
-----BEGIN OPENSSH PRIVATE KEY-----
b3BlbnNzaC1rZXktdjEAAAAABG5vbmUtbm9uZS1ub25lAAAAAAAAAQAAAAM...
(entire content)
-----END OPENSSH PRIVATE KEY-----
```

---

## **ধাপ ४: PM2 Setup করুন (Optional কিন্তু Recommended)**

```bash
cd /var/www/streaming-system

# PM2 install করুন
sudo npm install -g pm2

# Logs directory তৈরি করুন
mkdir -p logs

# PM2 startup script install করুন
pm2 startup
pm2 start ecosystem.config.cjs
pm2 save
```

---

## **ধাপ ५: Test করুন**

```bash
# Local এ কোন change করুন
cd ~/your-local-repo
echo "# Updated" >> README.md
git add .
git commit -m "Test deployment"
git push origin main
```

**GitHub Actions দেখুন:**
https://github.com/mdrifathossain1999/24-7-Live-Streaming-Management-System/actions

---

## **Deployment Trigger করার উপায়**

### ১. Automatic (Recommended)
- `main` branch এ প্রতিটি push হলে স্বয়ংক্রিয়ভাবে deploy হবে

### २. Manual
- GitHub Actions tab এ যান
- **Deploy to Production** workflow select করুন
- **Run workflow** ক্লিক করুন

---

## **Troubleshooting**

### Error: "missing server host"
- **কারণ:** `VPS_HOST` secret সেট করা নেই
- **সমাধান:** GitHub Secrets এ `VPS_HOST` add করুন

### Error: "Permission denied (publickey)"
- **কারণ:** SSH key সেটআপ সঠিক নয়
- **সমাধান:** 
  ```bash
  # VPS এ GitHub authorize করুন
  ssh-keyscan -H github.com >> ~/.ssh/known_hosts
  ssh -T git@github.com
  ```

### Deployment slow?
- **সমাধান:** VPS এ Node.js version update করুন
  ```bash
  sudo apt update && sudo apt upgrade -y
  ```

---

## **Monitoring**

Deployment status check করুন:

```bash
# VPS এ
cd /var/www/streaming-system

# PM2 status দেখুন
pm2 status
pm2 logs streaming-system

# Application logs
tail -f logs/out.log
```

---

## **আরও সাহায্য?**

- GitHub Issues: https://github.com/mdrifathossain1999/24-7-Live-Streaming-Management-System/issues
- PM2 Documentation: https://pm2.keymetrics.io/

