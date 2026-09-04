# 1. Jalankan stack tanpa TLS dulu buat validasi certbot HTTP-01 challenge

mkdir -p nginx
docker network create ems_network || true
docker compose -f docker-compose.yml -f docker-compose.proxy.yml up -d nginx backend postgres redis

# 2. Minta sertifikat pertama kali

docker compose -f docker-compose.proxy.yml run --rm certbot \
 certonly --webroot -w /var/www/certbot \
 -d ems.example.com --email kamu@falahtech.co.id --agree-tos --no-eff-email

# 3. Restart nginx supaya baca sertifikat yang baru

docker compose -f docker-compose.proxy.yml restart nginx
