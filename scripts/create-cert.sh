#!/bin/bash
set -eo pipefail

# http://apetec.com/support/GenerateSAN-CSR.htm
# http://chschneider.eu/linux/server/openssl.shtml

DOMAIN=$1
IP=$2
if [ -z "$DOMAIN" ]; then DOMAIN=c9.dev; fi
if [ -z "$IP" ]; then IP=127.0.0.1; fi

if [[ "$DOMAIN" =~ [/[:space:]] ]]; then echo "Invalid domain name $DOMAIN"; exit 1; fi

FQDN="
IP.1 = $IP
DNS.1 = $DOMAIN
DNS.2 = *.$DOMAIN
"

CRT_NAME=$DOMAIN

echo creating certificates for $FQDN at CRT_NAME

mkdir -p tmp

echo '
[req]
distinguished_name = req_distinguished_name
req_extensions = v3_req

[req_distinguished_name]
commonName = Internet Widgits Ltd
commonName_max	= 64

[ v3_req ]
# Extensions to add to a certificate request
basicConstraints = CA:FALSE
keyUsage = nonRepudiation, digitalSignature, keyEncipherment
extendedKeyUsage = serverAuth
subjectAltName = @alt_names

[alt_names]
'"$FQDN" > tmp/openssl.cnf

# Generate a private key
openssl genrsa -out tmp/$CRT_NAME.key 2048
# Create the CSR file
openssl req -new -out tmp/$CRT_NAME.csr -key tmp/$CRT_NAME.key -config tmp/openssl.cnf \
    -subj "/C=NL/ST=Noord-Holland/L=Amsterdam/OU=ACME Self Signed CA"
    
# check
# openssl req -text -noout -in $CRT_NAME.csr

# Self-sign and create the certificate:
openssl x509 -req -days 3650 -in tmp/$CRT_NAME.csr -signkey tmp/$CRT_NAME.key\
    -out tmp/$CRT_NAME.crt -extensions v3_req -extfile tmp/openssl.cnf

cat tmp/$CRT_NAME.crt >  tmp/$CRT_NAME.pem
cat tmp/$CRT_NAME.key >> tmp/$CRT_NAME.pem

mv tmp/$CRT_NAME.pem ./$CRT_NAME.pem
mv tmp/$CRT_NAME.crt ./$CRT_NAME.crt

rm -r tmp

echo '
To add the custom cerificate:
On Windows run
    certutil -addstore "Root" '"$CRT_NAME"'.crt # to add certificate to root
    cmd.exe /c "certmgr.msc" # to see installed certificates
On Mac
    sudo security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain '"$CRT_NAME"'.crt
On Linux
    TODO

For older versions of firefox set
    pref("security.enterprise_roots.enabled", true);
'
