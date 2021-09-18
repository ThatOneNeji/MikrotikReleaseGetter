# MikrotikReleaseGetter

## Overview
This application scraps the URLs for various ROS releases and then downloads the files based on version. It also tries to get the SHA256 values from the Mikrotik download page and then tries to compare them to the files downloaded. As an extra the SHA256 hashes are saved with the rest of the downloaded files in SHA256SUMS.

## Usage
In order to use this application, node version >=14.x is required. If you do not have NodeJS installed then you can get it from https://nodejs.org/en/download/ 

Make sure that the npm modules are installed:
```Bash
npm install
```
Then start the application:
```Bash
node main.js
```
The logs will be displayed on screen as per then following:
```
node .\main.js
[2021-09-18T07:10:22.946] [INFO] MikrotikReleaseGetter - Starting
[2021-09-18T07:10:22.950] [DEBUG] MikrotikReleaseGetter - Path "download" exists
[2021-09-18T07:11:00.392] [INFO] MikrotikReleaseGetter - Running cron...
[2021-09-18T07:11:01.356] [DEBUG] MikrotikReleaseGetter - HTTP statusCode: 200
[2021-09-18T07:11:01.938] [INFO] MikrotikReleaseGetter - Processing 2447 lines
[2021-09-18T07:11:01.940] [DEBUG] MikrotikReleaseGetter - Now working on release "6.47.10"
[2021-09-18T07:11:01.941] [DEBUG] MikrotikReleaseGetter - Path "download/6.47.10" exists  
[2021-09-18T07:11:02.014] [DEBUG] MikrotikReleaseGetter - Now working on release "6.48.4"
[2021-09-18T07:11:02.015] [DEBUG] MikrotikReleaseGetter - Path "download/6.48.4" exists
[2021-09-18T07:11:02.037] [DEBUG] MikrotikReleaseGetter - Now working on release "6.49beta54"
[2021-09-18T07:11:02.037] [DEBUG] MikrotikReleaseGetter - Path "download/6.49beta54" exists  
[2021-09-18T07:11:02.058] [DEBUG] MikrotikReleaseGetter - Now working on release "7.1rc3"
[2021-09-18T07:11:02.058] [DEBUG] MikrotikReleaseGetter - Path "download/7.1rc3" exists
```

## Tweaking
### Change cron interval
To change the interval, edit the config.json, section "cron". The default is every hour:
```JSON
"cron": "0 * * * *",
```
To change it to every 10 minutes, try the following:
```JSON
"cron": "*/10 * * * *",
```

### Change download location
The current download path is:
```JSON
"downloadPath": "download",
```
It will be located under this application's location.

You can change it to whatever you need it to be, such as:
```JSON
"downloadPath": "/home/username/Mikrotik_releases",
```
