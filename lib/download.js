const request = require('request');
const async = require('async');
const fs = require('fs');
const ProgressBar = require('progress');
let _Logging;
let defaultTimeOut;

/**
 * @typedef {Object} hashtypes
 * @property {string} md5 The MD5 message-digest algorithm is a cryptographically broken but still widely used hash function producing a 128-bit hash value
 * @property {string} sha256 SHA-2 (Secure Hash Algorithm 2) is a set of cryptographic hash functions
 * @description OpenSSL's hash
 */
/**
 * @typedef {Object} urlRequest
 * @property {string} filename Filename
 * @property {hashtypes} hashes OpenSSL's hash
 * @property {string} localfile localfile
 * @property {boolean} status status
 * @property {string} url url
 * @description This object contains the configuration information for the URL to be downloaded
 */
/**
 *
 */
class Downloader {
    /**
     *
     * @constructor
     * @param {function} logger The logging function that messages will be sent to
     * @param {number} timeout This is the default timeout value used for downloading files
     * @classdesc classdescclassdescclassdescclassdescclassdescclassdescclassdescclassdescclassdesc
     */
    constructor(logger, timeout) {
        _Logging = logger || false;
        this.q = async.queue(this.fetchOne, 1);
        defaultTimeOut = timeout || 10000;
        // Notify complete
        this.q.drain(function() {
            _Logging.info('All files fetched!');
        });

        // Notify Error
        this.q.error(function(err, task) {
            _Logging.error('Task: ', task);
            _Logging.error('Error:', JSON.stringify(err));
        });
    }

    /**
     *
     * @param {array} urls
     * @description Main function
     */
    fetchAllUrls(urls) {
        _Logging.info('Files to be downloaded ' + urls.length);
        for (const url of urls) {
            if (!url.status) {
                this.q.push(url);
            }
        }
    }

    /**
     *
     * @param {urlRequest} urlrequest This object contains the configuration information for the URL to be downloaded
     * @param {*} callback
     * @description Fetch a single file
     */
    fetchOne(urlrequest, callback) {
        const download = request(urlrequest.url, { timeout: defaultTimeOut });
        let progressBar;
        _Logging.info('Now downloading: ', urlrequest.url);
        download.on('response', (res) => {
            const len = parseInt(res.headers['content-length'], 10);
            progressBar = new ProgressBar('  Downloading [:bar] :rate/bps :percent :etas \t' + urlrequest.url, {
                width: 25,
                total: len,
                complete: '=',
                incomplete: ' '
            });
            download.on('data', (chunk) => {
                progressBar.tick(chunk.length);
            });
            download.on('error', (error) => {
                _Logging.error(error);
            });
            download.on('end', () => {
                _Logging.info('Finished with: ', urlrequest.url);
                callback();
            });
        });
        download.pipe(fs.createWriteStream(urlrequest.localfile));
    }
}

module.commandName = 'Downloader';
module.exports = Downloader;
module.helpText = 'Class used for multiple downloads';