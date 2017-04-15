#!/bin/bash
set -e 

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
pushd tmp
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
'"$FQDN" > openssl.cnf

# Generate a private key
openssl genrsa -out $CRT_NAME.key 2048
# Create the CSR file
openssl req -new -out $CRT_NAME.csr -key $CRT_NAME.key -config openssl.cnf \
    -subj "/C=NL/ST=Noord-Holland/L=Amsterdam/OU=ACME Self Signed CA"
    
# check
# openssl req -text -noout -in $CRT_NAME.csr

# Self-sign and create the certificate:
openssl x509 -req -days 3650 -in $CRT_NAME.csr -signkey $CRT_NAME.key\
	-out $CRT_NAME.crt -extensions v3_req -extfile openssl.cnf

cat $CRT_NAME.crt >  $CRT_NAME.pem
cat $CRT_NAME.key >> $CRT_NAME.pem

mv $CRT_NAME.pem ../$CRT_NAME.pem
mv $CRT_NAME.crt ../$CRT_NAME.crt
popd
rm -r tmp

echo '
To add the custom cerificate:
On Windows run
    cmd.exe /c "certmgr.msc" # to see installed certificates
    certutil -addstore "Root" '"$CRT_NAME"'.crt # to add certificate to root
On Mac
    sudo security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain '"$CRT_NAME"'.crt
On Linux
    TODO

For older versions of firefox set
    pref("security.enterprise_roots.enabled", true);
'
