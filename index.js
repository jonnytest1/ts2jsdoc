const chokidar = require('chokidar');
const { readFile, writeFile } = require('fs/promises');
const { createSourceFile, ScriptKind, ScriptTarget,
    isSourceFile, SourceFile, Node, SyntaxKind, isParameter,
    isFunctionExpression, isFunctionDeclaration } = require("typescript")
const ts = require("typescript")

const transformer = (context) => {
    return (rootNode) => {
        function visit(node) {
            node = ts.visitEachChild(node, visit, context);
            // in a property access expression like "foo.bar" "foo" is the expression and "bar" is the name : 
            // we replace the whole expression with just node.expression in the case name is "accessorToBeRemoved"

            if(ts.isFunctionDeclaration(node)) {
                const params = []

                node.parameters = node.parameters.map(param => {
                    if(param.type) {
                        params.push({ name: param.name.getText(), type: param.type.getText() })
                        delete param.type
                    }

                    return param
                })
                if(params.length) {
                    const paramStr = params.map(p => `* @param {${p.type}} ${p.name}\n `).join("\n")
                    ts.addSyntheticLeadingComment(node, SyntaxKind.MultiLineCommentTrivia, `*\n ${paramStr}`)
                }
                return node;
            }
            return node;
        }
        return ts.visitNode(rootNode, visit);
    }
}


chokidar.watch(__dirname, {
    ignoreInitial: true
}).on("all", async (e, path) => {

    const file = await readFile(path, { encoding: "utf8" })
    const fileTree = createSourceFile(path, file, ScriptTarget.Latest, true, ScriptKind.JS)
    const result = ts.transform(
        fileTree, [transformer]
    );
    const transformedSourceFile = result.transformed[0];
    const printer = ts.createPrinter();
    const newContent = printer.printFile(transformedSourceFile)
    result.dispose()

    console.log(newContent)
    await writeFile(path, newContent, { encoding: "utf8" })
})