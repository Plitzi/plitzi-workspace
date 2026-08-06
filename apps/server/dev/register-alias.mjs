import { register } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const loaderPath = pathToFileURL(path.resolve('./dev/alias-loader.mjs')).href;
register(loaderPath, pathToFileURL(process.cwd()).href);
