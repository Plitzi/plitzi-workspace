/** Side-effect CSS imports: the plugin compiler emits them as the plugin's own stylesheet, and the server serves
 *  it beside the bundle. TypeScript has nothing to say about them and needs to be told so. */
declare module '*.css';
