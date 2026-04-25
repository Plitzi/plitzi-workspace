import { register } from 'node:module';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const loaderPath = pathToFileURL(path.resolve('./src/standalone/alias-loader.mjs')).href;
register(loaderPath, pathToFileURL(process.cwd()).href);
