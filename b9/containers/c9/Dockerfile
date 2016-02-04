FROM debian:8.2

MAINTAINER Cloud9 IDE, Inc. <info@c9.io>
ENV DEBIAN_FRONTEND noninteractive

# ubuntu user
RUN useradd --uid 1000 --shell /bin/bash -m --home-dir /home/ubuntu ubuntu && \
    chmod 777 /tmp

RUN apt-get update && \
    apt-get install -y curl openssh-client rsync && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/*

# install nodejs
RUN curl https://nodejs.org/dist/v0.10.41/node-v0.10.41-linux-x64.tar.gz | tar xvzf - -C /usr/local --strip-components=1

USER ubuntu

EXPOSE 8080
WORKDIR /home/ubuntu/newclient