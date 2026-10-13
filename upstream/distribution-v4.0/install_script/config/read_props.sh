#!/bin/bash

: ${INSTAL_CONFIG_FILE:="./install_config.conf"}

function get_property
{
    grep "^$1=" "${INSTAL_CONFIG_FILE}" | cut -d'=' -f2 | sed -e 's/\r//g'
}

DB_NAME=$(get_property "DB_NAME")
SEN2AGRI_SERVICES=$(get_property "SEN2AGRI_SERVICES")

res=$($DB_NAME | od -c)
echo $res

#echo "DB name = ${DB_NAME}"
#echo "SEN2AGRI_SERVICES = ${SEN2AGRI_SERVICES}"
