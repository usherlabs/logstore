#!/bin/sh

sudo ssh ubuntu@dev-network \
  -N \
  -L 80:localhost:80 \
  -L 1317:localhost:1317 \
  -L 3000:localhost:3000 \
  -L 5432:localhost:5432 \
  -L 7771:localhost:7771 \
  -L 7772:localhost:7772 \
  -L 7773:localhost:7773 \
  -L 8000:localhost:8000 \
  -L 8081:localhost:8081 \
  -L 8545:localhost:8545 \
  -L 8546:localhost:8546 \
  -L 8801:localhost:8801 \
  -L 9042:localhost:9042 \
  -L 26657:localhost:26657 \
  -L 30301:localhost:30301 \
  -L 30302:localhost:30302 \
  -L 30303:localhost:30303
