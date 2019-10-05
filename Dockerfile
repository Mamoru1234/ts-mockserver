FROM node:12.11.0-alpine

WORKDIR /usr/app/mockserver

ENV CONTROL_PORT 3045
ENV MOCK_PORT 3046

COPY ./package.server.json ./package.json
RUN npm i
COPY . .
CMD [ "node", "server.js" ]
