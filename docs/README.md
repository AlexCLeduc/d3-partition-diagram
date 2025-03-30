
## Prettier and eslint

Make sure that your project's vscode settings.json include:

```json
"[typescript]": {
  "editor.tabSize": 2,
  "editor.formatOnSave": true
},
"eslint.validate": [
  "javascript",
  "javascriptreact",
  "typescript",
  "typescriptreact",
],
"eslint.workingDirectories": [
  "./src/"
],
"editor.codeActionsOnSave": {
  "source.fixAll.eslint": true
}
```

1. You can test that prettier is working by adding a bunch of new lines anywhere and saving a file. It should result in deleting some of the lines you added.
2. You can test that eslint is working by changing the order of imports and saving. It should result in re-sorting your imports.


# Deploying

1. `npm run build`
