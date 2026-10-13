#!/bin/bash

DB_NAME="sen2agri"
if [ $# -eq 1 ] ; then
    DB_NAME=$1
    echo "Using database $DB_NAME ..."
fi

systemctl stop sen2agri-scheduler sen2agri-executor sen2agri-orchestrator sen2agri-http-listener sen2agri-sentinel-downloader sen2agri-landsat-downloader sen2agri-demmaccs sen2agri-sentinel-downloader.timer sen2agri-landsat-downloader.timer sen2agri-demmaccs.timer sen2agri-monitor-agent sen2agri-services  sen2agri-fmask.timer sen2agri-fmask sen2agri-era5-downloader.timer 

systemctl disable sen2agri-scheduler sen2agri-executor sen2agri-orchestrator sen2agri-http-listener sen2agri-sentinel-downloader sen2agri-landsat-downloader sen2agri-demmaccs sen2agri-sentinel-downloader.timer sen2agri-landsat-downloader.timer sen2agri-demmaccs.timer sen2agri-monitor-agent sen2agri-services  sen2agri-fmask.timer sen2agri-fmask sen2agri-era5-downloader.timer 

yum -y remove sen2agri-processors sen2agri-website sen2agri-downloaders-demmaccs sen2agri-app

rm -fR /usr/share/sen2agri
# rm -fR /opt/maja
# rm -fR /mnt/archive/srtm /mnt/archive/swbd

if [ -d "/home/sen2agri-service/miniconda3" ] ; then 
    rm -fR "/home/sen2agri-service/miniconda3"
fi 

systemctl stop slurmd slurmctld slurmdbd munge
systemctl disable slurmd slurmctld slurmdbd munge

yum -y remove slurm slurm-devel slurm-munge slurm-perlapi slurm-pam_slurm slurm-plugins slurm-sjobexit slurm-sjstat slurm-slurmdbd slurm-slurmdb-direct slurm-sql slurm-torque munge-devel munge-libs munge

systemctl stop mariadb 
systemctl disable mariadb

yum -y remove mariadb-server mariadb-devel mariadb

psql -U admin sen4cap -c "SELECT pg_terminate_backend (pid) FROM pg_stat_activity WHERE datname = '${DB_NAME}';"
psql -U postgres -c "drop database ${DB_NAME};"
psql -U postgres -c "DROP ROLE IF EXISTS admin"
psql -U postgres -c "DROP ROLE IF EXISTS \"sen2agri-service\""

yum -y remove otb gdal-local

# yum -y remove boost tinyxml tinyxml-devel qt qt5-qtbase qt-x11 fftw gdal geos libgeotiff libsvm muParser opencv openjpeg2 openjpeg2-tools proj proj-epsg swig qt5-qtbase-postgresql gsl cifs-utils

sudo userdel -f -r "sen2agri-service"
sudo userdel -f -r slurm
docker ps -a | grep "sen4cap" | awk '{print $1}' | xargs docker rm -f 
docker ps -a | grep "sen4x" | awk '{print $1}' | xargs docker rm -f 
docker ps -a | grep "t-rex" | awk '{print $1}' | xargs docker rm -f 
docker ps -a | grep "postgis" | awk '{print $1}' | xargs docker rm -f 

docker images -a | grep "sen4cap" | awk '{print $3}' | xargs docker rmi -f
docker images -a | grep "sen4x" | awk '{print $3}' | xargs docker rmi -f
docker images -a | grep "t-rex" | awk '{print $3}' | xargs docker rmi -f
docker images -a | grep "postgis" | awk '{print $3}' | xargs docker rmi -f