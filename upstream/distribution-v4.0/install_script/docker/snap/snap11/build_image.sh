#!/bin/bash
tar -czh . | docker build -t sen4cap/snap:11.0.0 -