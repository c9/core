FROM debian:8.2

MAINTAINER Cloud9 IDE, Inc. <info@c9.io>
ENV DEBIAN_FRONTEND noninteractive

RUN apt-get update
RUN apt-get install -y curl

# ubuntu user
RUN useradd --uid 1000 --shell /bin/bash -m --home-dir /home/ubuntu ubuntu && \
    chmod 777 /tmp

# make ubuntu user sudo
RUN apt-get install -y sudo && \
    sed -i 's/%sudo\s.*/%sudo ALL=NOPASSWD:ALL/' /etc/sudoers && \
    usermod -a -G sudo ubuntu

RUN chown root:root /usr/bin/sudo && chmod 4755 /usr/bin/sudo

# install nodejs
RUN mkdir /nodejs && curl https://nodejs.org/dist/v0.10.40/node-v0.10.40-linux-x64.tar.gz | tar xvzf - -C /usr/local --strip-components=1
RUN npm install -g npm@2.14.11

# oldclient
RUN apt-get install -y openssh-client

# test runner
RUN npm install -g mocha

# install jsonalzyer dependencies
RUN apt-get install -y golang tmux python python-pip pylint php5 ruby build-essential

# test runner
RUN apt-get install -y redis-server

# for odev
RUN apt-get install -y haproxy

# for CI
RUN apt-get install -y git

ADD files/ssh_config /home/ubuntu/.ssh/config
RUN chown -R ubuntu:ubuntu /home/ubuntu/.ssh

USER ubuntu

# Cloud9 installer
RUN curl -L https://raw.githubusercontent.com/c9/install/master/install.sh | bash

EXPOSE 8080
VOLUME /home/ubuntu/newclient
WORKDIR /home/ubuntu/newclient