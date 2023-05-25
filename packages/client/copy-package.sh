#!/bin/bash
mkdir -p dist/
node copy-package.js
cp -f README.md LICENSE dist
