// Use no-explicit-any and no-non-null-assertions, because this is a third-party module that we don't intend to change to support these linter rules.
/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-non-null-assertion */
const window: any = undefined;

function phpUnserialize(data: string) {
    //  discuss at: http://locutus.io/php/unserialize/
    // original by: Arpad Ray (mailto:arpad@php.net)
    // improved by: Pedro Tainha (http://www.pedrotainha.com)
    // improved by: Kevin van Zonneveld (http://kvz.io)
    // improved by: Kevin van Zonneveld (http://kvz.io)
    // improved by: Chris
    // improved by: James
    // improved by: Le Torbi
    // improved by: Eli Skeggs
    // bugfixed by: dptr1988
    // bugfixed by: Kevin van Zonneveld (http://kvz.io)
    // bugfixed by: Brett Zamir (http://brett-zamir.me)
    // bugfixed by: philippsimon (https://github.com/philippsimon/)
    //  revised by: d3x
    //    input by: Brett Zamir (http://brett-zamir.me)
    //    input by: Martin (http://www.erlenwiese.de/)
    //    input by: kilops
    //    input by: Jaroslaw Czarniak
    //    input by: lovasoa (https://github.com/lovasoa/)
    //      note 1: We feel the main purpose of this function should be
    //      note 1: to ease the transport of data between php & js
    //      note 1: Aiming for PHP-compatibility, we have to translate objects to arrays
    //   example 1: unserialize('a:3:{i:0;s:5:"Kevin";i:1;s:3:"van";i:2;s:9:"Zonneveld";}')
    //   returns 1: ['Kevin', 'van', 'Zonneveld']
    //   example 2: unserialize('a:2:{s:9:"firstName";s:5:"Kevin";s:7:"midName";s:3:"van";}')
    //   returns 2: {firstName: 'Kevin', midName: 'van'}
    //   example 3: unserialize('a:3:{s:2:"ü";s:2:"ü";s:3:"四";s:3:"四";s:4:"𠜎";s:4:"𠜎";}')
    //   returns 3: {'ü': 'ü', '四': '四', '𠜎': '𠜎'}

    const $global = typeof window !== 'undefined' ? window : global;

    const utf8Overhead = function (str: string) {
        let s = str.length;
        for (let i = str.length - 1; i >= 0; i--) {
            const code = str.charCodeAt(i);
            if (code > 0x7f && code <= 0x7ff) {
                s++;
            } else if (code > 0x7ff && code <= 0xffff) {
                s += 2;
            }
            // trail surrogate
            if (code >= 0xdc00 && code <= 0xdfff) {
                i--;
            }
        }
        return s - 1;
    };
    const error = function (type: string, msg: string) {
        throw new $global[type](msg);
    };
    const readUntil = function (data: string, offset: number, stopchr: string): [number, string] {
        let i = 2;
        const buf: unknown[] = [];
        let chr = data.slice(offset, offset + 1);

        while (chr !== stopchr) {
            if (i + offset > data.length) {
                error('Error', 'Invalid');
            }
            buf.push(chr);
            chr = data.slice(offset + (i - 1), offset + i);
            i += 1;
        }
        return [buf.length, buf.join('')];
    };
    const readChrs = function (data: string, offset: number, length: number): [number, string] {
        let i, chr;

        const buf: unknown[] = [];
        for (i = 0; i < length; i++) {
            chr = data.slice(offset + (i - 1), offset + i);
            buf.push(chr);
            length -= utf8Overhead(chr);
        }
        return [buf.length, buf.join('')];
    };
    function _unserialize(data: string, offset: number) {
        let dataoffset;
        let keyandchrs;
        let keys: string;
        let contig;
        let length;
        let array;
        let readdata: any;
        let readData;
        let ccount;
        let stringlength;
        let i;
        let key;
        let kprops;
        let kchrs;
        let vprops;
        let vchrs;
        let value;
        let chrs = 0;
        let typeconvert = function (x: any) {
            return x;
        };

        if (!offset) {
            offset = 0;
        }
        const dtype = data.slice(offset, offset + 1).toLowerCase();

        dataoffset = offset + 2;

        switch (dtype) {
            case 'i':
                typeconvert = function (x) {
                    return parseInt(x, 10);
                };
                readData = readUntil(data, dataoffset, ';');
                chrs = readData[0];
                readdata = readData[1];
                dataoffset += chrs + 1;
                break;
            case 'b':
                typeconvert = function (x) {
                    return parseInt(x, 10) !== 0;
                };
                readData = readUntil(data, dataoffset, ';');
                chrs = readData[0];
                readdata = readData[1];
                dataoffset += chrs + 1;
                break;
            case 'd':
                typeconvert = function (x) {
                    return parseFloat(x);
                };
                readData = readUntil(data, dataoffset, ';');
                chrs = readData[0];
                readdata = readData[1];
                dataoffset += chrs + 1;
                break;
            case 'n':
                readdata = null;
                break;
            case 's':
                ccount = readUntil(data, dataoffset, ':');
                chrs = ccount[0];
                stringlength = ccount[1];
                dataoffset += chrs + 2;

                readData = readChrs(data, dataoffset + 1, parseInt(stringlength, 10));
                chrs = readData[0];
                readdata = readData[1];
                dataoffset += chrs + 2;
                if (chrs !== parseInt(stringlength, 10) && chrs !== readdata.length) {
                    error('SyntaxError', 'String length mismatch');
                }
                break;
            case 'a':
                readdata = {};

                keyandchrs = readUntil(data, dataoffset, ':');
                chrs = keyandchrs[0];
                keys = keyandchrs[1];
                dataoffset += chrs + 2;

                length = parseInt(keys as any, 10);
                contig = true;

                for (i = 0; i < length; i++) {
                    kprops = _unserialize(data, dataoffset);
                    kchrs = kprops[1];
                    key = kprops[2];
                    dataoffset += kchrs;

                    vprops = _unserialize(data, dataoffset);
                    vchrs = vprops[1];
                    value = vprops[2];
                    dataoffset += vchrs;

                    if (key !== i) {
                        contig = false;
                    }

                    readdata[key] = value;
                }

                if (contig) {
                    array = new Array(length);
                    for (i = 0; i < length; i++) {
                        array[i] = readdata[i];
                    }
                    readdata = array;
                }

                dataoffset += 1;
                break;
            default:
                // error('SyntaxError', 'Unknown / Unhandled data type(s): ' + dtype)
                break;
        }
        return [dtype, dataoffset - offset, typeconvert(readdata)];
    }

    return _unserialize(data + '', 0)[2];
}

export default function unserializeSession(input: string) {
    if (!input) return {};
    try {
        return JSON.parse(input);
    } catch (e) {
        // try to unserialize using PHP unserialization
        return input.split(/\|/).reduce(function (output, part, index, parts) {
            // First part = $key
            if (index === 0) {
                output._currKey = part;
            } else if (index === parts.length - 1) {
                // Last part = $someSerializedStuff
                output[output._currKey] = phpUnserialize(part);
                delete output._currKey;
            } else {
                // Other output = $someSerializedStuff$key
                const repper = part.replace(/(\n|\r)/g, ' ');
                const match = repper.match(/^((?:.*?[;}])+)([^;}]+?)$/);
                if (match) {
                    output[output._currKey] = phpUnserialize(match[1]!);
                    output._currKey = match[2];
                } else {
                    throw new Error('Parse error on part "' + part + '"');
                }
            }
            return output;
        }, {} as any);
    }
}
