# docker build -t smf-sdk --rm .
# docker run -p 8080:8080 -it -v /tmp/build:/home/ubuntu/c9sdk/build $(pwd):/home/ubuntu/c9sdk:ro smf-sdk

FROM cloud9/ws-smartface

USER ubuntu
WORKDIR /home/ubuntu
RUN curl -L https://raw.githubusercontent.com/c9/install/master/install.sh | bash

EXPOSE 8080
VOLUME /home/ubuntu/c9sdk

CMD /home/ubuntu/.nvm/versions/node/v0.12.7/bin/node /home/ubuntu/c9sdk/server.js -l 0.0.0.0 -p 8080 -a : -w /home/ubuntu/workspace --smf