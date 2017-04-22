#!/bin/bash

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

echo $DIR

zip -r main.zip "$DIR/main"

echo "Done"
