#!/usr/bin/env sh

npm run buildClient

cp ./package.client.json ./build/client/package.json
cd ./build/client
npm pack
