'strict';

const https = require('https');
const log4js = require('log4js');
const cron = require('node-cron');
const request = require('request');
const appConfig = require('./config.json');
const logger = log4js.getLogger('MikrotikReleaseGetter');
const fs = require('fs');
const xmlParser = require('xml2json');

const NodeHtmlMarkdown = require('node-html-markdown');
// import { NodeHtmlMarkdown, NodeHtmlMarkdownOptions } from 'node-html-markdown';
const nhm = new NodeHtmlMarkdown.NodeHtmlMarkdown(
    /* options (optional) */
    {},
    /* customTransformers (optional) */
    undefined,
    /* customCodeBlockTranslators (optional) */
    undefined
);

const tls = require('tls');
const path = require('path');
const async = require('async');
const crypto = require('crypto');
let certFilePath;
log4js.configure(appConfig.logger);
logger.info('Starting');

createDirectory(appConfig.downloadPath);
updateSSLCert();

const httpOptionsDownloads = {
    host: appConfig.web.host,
    path: appConfig.web.path,
    encoding: 'binary',
    method: 'GET'
};

const httpOptionsChangelogs = {
    host: appConfig.web.host,
    path: appConfig.web.changelog,
    encoding: 'binary',
    method: 'GET'
};

/* typedefs */
/**
 * @typedef {Object} exitOptions
 * @property {boolean} exit Is this an exit
 * @property {string} type What is the type that was called in order to exit the application
 * @property {string} description The description of the type of exit
 * @description This object contains the exit information of the application
 */

/**
 * @typedef {Object} fileObject
 * @property {string} url Target URL of file
 * @property {string} filename File name
 * @property {string} sha256 SHA256 hash for file
 * @property {string} filepath Local file path
 * @property {string} status Status so far
 * @property {string} size Size of local file
 * @description This object contains the information for file to be downloaded
 */

/**
 * @typedef {Object} releaseObject
 * @property {string} version Scrapped version
 * @property {array} rawurls All scrapped URLs for this release
 * @property {array} urls Array of download URLs with no duplicates
 * @property {array} sha256 Array of hashes
 * @property {fileObject[]} objs This object contains the information for file to be downloaded
 * @description This object contains information for all releases
 */

/**
 * @typedef {Object} releasesObjects
 * @property {releaseObject} longterm This object contains scrapped information for a release
 * @property {releaseObject} stable This object contains scrapped information for a release
 * @property {releaseObject} testing This object contains scrapped information for a release
 * @property {releaseObject} development This object contains scrapped information for a release
 * @description This object contains scrapped information for a release
 */


/* Regex list */
/**
 * @const {string} regexPatternLongTermRelease - Regex pattern to match Long Term release
 */
const regexPatternLongTermRelease = />(?<release>[0-9a-zA-Z\.]+)\s\(L/gm;
/**
 * @const {string} regexPatternStableRelease - Regex pattern to match Stable release
 */
const regexPatternStableRelease = />(?<release>[0-9a-zA-Z\.]+)\s\(S/gm;
/**
 * @const {string} regexPatternTestingRelease - Regex pattern to match Testing release
 */
const regexPatternTestingRelease = />(?<release>[0-9a-zA-Z\.]+)\s\(T/gm;
/**
 * @const {string} regexPatternDevelopmentRelease - Regex pattern to match Development release
 */
const regexPatternDevelopmentRelease = />(?<release>[0-9a-zA-Z\.]+)\s\(D/gm;


/**
 * @const {releasesObjects} releases - This object contains information for all releases
 */
const releases = {
    longterm: {
        version: '',
        rawurls: [],
        urls: [],
        sha256: [],
        objs: []
    },
    stable: {
        version: '',
        rawurls: [],
        urls: [],
        sha256: [],
        objs: []
    },
    testing: {
        version: '',
        rawurls: [],
        urls: [],
        sha256: [],
        objs: []
    },
    development: {
        version: '',
        rawurls: [],
        urls: [],
        sha256: [],
        objs: []
    }
};


process.stdin.resume(); // so the program will not close instantly

/**
 *
 * @param {exitOptions} options This object contains the exit information of the application
 * @param {string} exitCode Exit code of application
 * @description This function handles the exiting of the application
 */
function exitHandler(options, exitCode) {
    const msg = {
        signal: options.type,
        description: options.description,
        exitcode: exitCode
    };
    logger.debug(msg);
    if (options.exit) {
        process.exit();
    }
}

// do something when app is closing
process.on('exit', (code) => {
    const msg = { cleanup: true, type: 'exit', code: code };
    logger.debug('Application shut down: ' + JSON.stringify(msg));
});
// catches ctrl+c event
process.on('SIGINT', exitHandler.bind(null, { exit: true, type: 'SIGINT', description: 'SIGINT is generated by the user pressing Ctrl+C and is an interrupt' }));
// catches "kill pid" (for example: nodemon restart)
process.on('SIGUSR1', exitHandler.bind(null, { exit: true, type: 'SIGUSR1', description: 'The SIGUSR1 signal is sent to a process to indicate user-defined conditions' }));
process.on('SIGUSR2', exitHandler.bind(null, { exit: true, type: 'SIGUSR2', description: 'The SIGUSR2 signal is sent to a process to indicate user-defined conditions' }));
// catches uncaught exceptions
process.on('uncaughtException', (error) => {
    const msg = {
        exit: true,
        type: error.name,
        description: error.message,
        stack: error.stack
    };
    exitHandler.bind(null, msg);
    logger.debug(msg);
    process.exit(1);
});

/**
 *
 * @param {string} pathstr Target directory path
 * @description This function checks to see if there already exits a target path and if not, then create it
 */
function createDirectory(pathstr) {
    if (fs.existsSync(pathstr)) {
        logger.debug('Path "' + pathstr + '" exists');
    } else {
        logger.debug('Path "' + pathstr + '" does not exist, creating it...');
        fs.mkdirSync(pathstr);
    }
}

/**
 * @description This function updates the cert.pem file
 */
function updateSSLCert() {
    certFilePath = path.join(__dirname, 'cert.pem');
    const tlsData = tls.rootCertificates.join('\n');
    fs.writeFileSync(certFilePath, tlsData);
}

/**
 *
 * @param {string} line Raw line to be used to check if it contains a release value
 * @description This function checks to see if the supplied line matches any of the release's regex patterns
 */
function getReleases(line) {
    const reExec1 = regexPatternLongTermRelease.exec(line);
    if (reExec1) {
        releases.longterm.version = reExec1.groups.release;
    }
    const reExec2 = regexPatternStableRelease.exec(line);
    if (reExec2) {
        releases.stable.version = reExec2.groups.release;
    }
    const reExec3 = regexPatternTestingRelease.exec(line);
    if (reExec3) {
        releases.testing.version = reExec3.groups.release;
    }
    const reExec4 = regexPatternDevelopmentRelease.exec(line);
    if (reExec4) {
        releases.development.version = reExec4.groups.release;
    }
}

/**
 *
 * @param {string} localFile Target file
 * @return {boolean}
 * @description This function checks to see if the target file exists
 */
function checkIfFileExists(localFile) {
    let fileRes = false;
    try {
        const stats = fs.statSync(localFile);
        if (stats.size) {
            fileRes = true;
        }
    } catch (err) {
        if (err.code != 'ENOENT') {
            logger.error('Problem with checking file "' + localFile + '":' + JSON.stringify(err));
        }
    }
    return fileRes;
}

/**
 *
 * @param {string} filename Target file to be checked
 * @return {number|boolean}
 * @description This function tries to get the size of the target file
 */
function getFileStats(filename) {
    try {
        const stats = fs.statSync(filename);
        return stats.size;
    } catch (err) {
        logger.error('Problem getting stats for file "' + localFile + '":' + JSON.stringify(err));
    }
    return false;
}


/**
 *
 * @param {string} localFile Target local file name
 * @param {string} remotePath Remote file name
 * @param {function} callback Callback function
 * @description This function actually downloads the remote file
 */
function download(localFile, remotePath, callback) {
    const localStream = fs.createWriteStream(localFile);
    const out = request({ uri: remotePath });
    out.on('response', function(resp) {
        if (resp.statusCode === 200) {
            out.pipe(localStream);
            localStream.on('close', function() {
                callback(null, localFile);
            });
        } else {
            callback(new Error('No file found at given url.'), null);
        }
    });
}

/**
 *
 * @param {string} uri Uniform Resource Identifier
 * @param {array} rawPage Lines from the download page
 * @return {fileObject}
 * @description This function scraps the SHA256 hash for the various files
 */
function buildFileObject(uri, rawPage) {
    const fObj = {
        url: uri,
        filename: uri.split('/').reverse()[0],
        sha256: ''
    };

    const shaRegex = new RegExp('>' + fObj.filename + '</td><td>MD5</td><td>[a-zA-Z0-9]+</td></tr><tr><td>SHA256</td><td>(?<sha_1>[a-zA-Z0-9]+)</td>|<b>SHA256 </b>' + fObj.filename + ': (?<sha_2>[a-zA-Z0-9]+)<br', 'i');
    rawPage.forEach((line) => {
        const shaExec = shaRegex.exec(line);
        if (shaExec) {
            if (shaExec.groups.sha_1) {
                fObj.sha256 = shaExec.groups.sha_1;
            } else {
                fObj.sha256 = shaExec.groups.sha_2;
            }
        }
    });
    return fObj;
}

/**
 *
 * @param {array} objs Array of objects that contain filenames and their hashes
 * @param {string} downloadPath Target location to where the file must be written to
 * @description This function creates the SHA256SUMS file that contains the hashes per file
 */
function createSumsFile(objs, downloadPath) {
    const sums = [];
    objs.forEach((element) => {
        sums.push(element.sha256 + ' *' + element.filename);
    });
    try {
        fs.writeFileSync(downloadPath + 'SHA256SUMS', sums.join('\n'), { encoding: 'utf8', flag: 'w' });
    } catch (e) {
        logger.error('Problem saving "' + downloadPath + 'SHA256SUMS" ' + JSON.stringify(e));
    }
}


/**
 *
 * @param {fileObject} item This object contains the information needed to verify the downloaded file
 * @return {fileObject}
 * @description This function checks to see that the download file's hash matches what was scrapped from the download page
 */
function verifyFile(item) {
    const testfile = fs.readFileSync(item.filepath);
    const sha256sum = crypto.createHash('sha256').update(testfile).digest('hex');
    logger.debug('Checking hash of "' + item.filepath + '"');
    if (item.sha256 == sha256sum) {
        item.status = 'Hash matches';
    } else {
        item.status = 'Hash failed';
    }
    return item;
}

/**
 *
 * @param {string} line
 * @param {string} pattern
 * @return {boolean}
 * @description description
 */
function ifRegexMatch(line, pattern) {
    const re = new RegExp(pattern);
    if (re.test(line)) {
        return true;
    }
    return false;
}

/**
 *
 * @param {string} release This is the release that will be searched for in order to get the changelog
 * @description This function gets the changelog entries for teh supplied release
 */
function getChangelog(release) {
    let str = '';
    let extractedChangelog = '';
    const req = https.request(httpOptionsChangelogs, (res) => {
        logger.debug('HTTP statusCode for "' + httpOptionsChangelogs.path + '":' + res.statusCode);
        res.on('data', (d) => {
            str += d;
        });
        res.on('end', function() {
            const changelogRaw = xmlParser.toJson(str);
            const changelogJSON = JSON.parse(changelogRaw);
            changelogJSON.rss.channel.item.forEach((element) => {
                if (ifRegexMatch(element.title, release)) {
                    extractedChangelog = element.description;
                }
            });
            try {
                fs.writeFileSync(appConfig.downloadPath + '/' + release + '/' + 'CHANGELOG.md', nhm.translate(extractedChangelog), { encoding: 'utf8', flag: 'w' });
            } catch (e) {
                logger.error('Problem saving "' + appConfig.downloadPath + '/' + release + '/' + 'CHANGELOG.md" ' + JSON.stringify(e));
            }
        });
    });

    req.on('error', (e) => {
        logger.error('Problem getting download page:' + JSON.stringify(e));
    });

    req.end();
}

cron.schedule(appConfig.cron, function() {
    logger.info('Running cron...');
    let str = '';
    const req = https.request(httpOptionsDownloads, (res) => {
        logger.debug('HTTP statusCode for "' + httpOptionsDownloads.path + '":' + res.statusCode);
        res.on('data', (d) => {
            str += d;
        });
        res.on('end', function() {
            const contentData = str.replace(/td>/g, '\n').replace(/li>/g, '\n').split('\n');
            logger.info('Processing ' + contentData.length + ' lines');
            contentData.forEach((line) => {
                getReleases(line);
            });
            for (const prop in releases) {
                if (Object.prototype.hasOwnProperty.call(releases, prop)) {
                    if (releases[prop].version) {
                        releases[prop].objs = [];
                        logger.debug('Now working on release "' + releases[prop].version + '"');

                        createDirectory(appConfig.downloadPath + '/' + releases[prop].version);
                        const dlRegex = new RegExp('<a href="(?<filename>[a-zA-Z0-9:.\\-\\/]+' + releases[prop].version + '[a-zA-Z0-9:._\\-\\/]+)', 'gm');

                        contentData.forEach((line) => {
                            const reExec = dlRegex.exec(line);
                            if (reExec) {
                                releases[prop].rawurls.push(reExec.groups.filename);
                            }
                        });

                        releases[prop].urls = [...new Set(releases[prop].rawurls)];
                        releases[prop].urls.sort().forEach((element) => {
                            releases[prop].objs.push(buildFileObject(element, str.split('\n')));
                        });
                        async.forEach(releases[prop].objs, function(item, cb) {
                            const localFileName = item.filename;
                            const filename = appConfig.downloadPath + '/' + releases[prop].version + '/' + localFileName;
                            item.filepath = filename;
                            item.status = 'downloading';
                            item.size = 0;
                            if (!checkIfFileExists(filename) || appConfig.redownload) {
                                download(filename, item.url, function(err, result) {
                                    if (err) {
                                        logger.error('Problem downloading file:' + JSON.stringify(err));
                                    }
                                    if (result) {
                                        item.status = 'done';
                                        item.size = getFileStats(filename);
                                        item = verifyFile(item);
                                        logger.info(item);
                                    }
                                    cb();
                                });
                            }
                        }, function(err) {
                            logger.error('Problem downloading files:' + JSON.stringify(err));
                        });
                        createSumsFile(releases[prop].objs, appConfig.downloadPath + '/' + releases[prop].version + '/');
                        getChangelog(releases[prop].version);
                    } else {
                        logger.debug('No version found for "' + prop + '"');
                    }
                }
            }
        });
    });

    req.on('error', (e) => {
        logger.error('Problem getting download page:' + JSON.stringify(e));
    });

    req.end();
});