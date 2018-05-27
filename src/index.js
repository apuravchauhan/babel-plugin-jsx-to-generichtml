export default function (babel) {
  const t = babel.types;
 
  function processLogicalExp(path, lazyTags) {
    let exp = path.node.expression;
    let body = exp.right;
    //unsupported currently
    if (!t.isJSXElement(body)) {
      return false;
    } else {
      //check if skip required inside expression: possible usecase for dynamic element
      let tag = body.openingElement.name.name;
      if (lazyTags.indexOf(tag) != -1) {
        path.remove();
        return false;
      }

    }
    let logicType = exp.operator;
    let logic = exp.left;
    //create pseudo element
    let pseudo = t.jSXIdentifier('PLUGIN-CONDITION');
    let pseudoDataAttr = t.jSXAttribute(t.jSXIdentifier('data'), t.jSXExpressionContainer(logic));
    let pseudoTypeAttr = t.jSXAttribute(t.jSXIdentifier('type'), t.stringLiteral(logicType));
    let pseudoOpen = t.jSXOpeningElement(pseudo, [pseudoDataAttr, pseudoTypeAttr], false);
    let pseudoClose = t.jSXClosingElement(t.jSXIdentifier('PLUGIN-CONDITION'));
    let pseudoEle = t.jSXElement(pseudoOpen, pseudoClose, [body]);
    path.replaceWith(pseudoEle);
  }
  function processCallExp(path) {
    let exp = path.node.expression;

    if (t.isCallExpression(exp) && exp.callee.property.name == 'map') {
      let object = exp.callee.object;
      let propPath = [];
      while (t.isMemberExpression(object)) {
        propPath.unshift(object.property.name);
        object = object.object;
      }
      //object should be an identifier if not a member exp
      propPath.unshift(object.name);
      let type = exp.arguments[0].params[0].name;
      let body = exp.arguments[0].body.body[0].argument;
      let prop = propPath.join('.');
      //create pseudo element
      let pseudo = t.jSXIdentifier('PLUGIN-LOOP');
      let pseudoDataAttr = t.jSXAttribute(t.jSXIdentifier('data'), t.stringLiteral(prop));
      let pseudoTypeAttr = t.jSXAttribute(t.jSXIdentifier('type'), t.stringLiteral(type));
      let pseudoOpen = t.jSXOpeningElement(pseudo, [pseudoDataAttr, pseudoTypeAttr], false);
      let pseudoClose = t.jSXClosingElement(t.jSXIdentifier('PLUGIN-LOOP'));
      let pseudoEle = t.jSXElement(pseudoOpen, pseudoClose, [body]);
      path.replaceWith(pseudoEle);
    }

  }

  return {
    visitor: {
      Program(path, state) {
        //init state variables
        state.importProps = {};
        state.opts.lazyTags = state.opts.lazyTags || [];
        Object.assign(state, { importProps: {}, exp: [], renderReturn: null, mainPlace: path });
      }
      ,
      ImportDeclaration(path, { importProps }) {
        let specifiers = path.node.specifiers;
        let loc = path.node.source.value;
        for (let obj of specifiers) {
          importProps[obj.local.name] = loc;
        }
        path.remove();
      },
      Class(path, state) {
        path.traverse({
          ClassMethod(path) {
            if (path.node.key.name === 'render') {
              let returnNode = path.node.body.body.filter(obj => t.isReturnStatement(obj));
              state.renderReturn = returnNode[0].argument;
              path.traverse({
                JSXExpressionContainer(path) {
                  state.exp.unshift(path);
                },
                JSXOpeningElement(path) {
                  let tag = path.node.name.name;
                  if (state.importProps.hasOwnProperty(tag)) {
                    path.node.attributes.push(t.jSXAttribute(t.jSXIdentifier('cust-loc'),
                      t.stringLiteral(state.importProps[tag])));
                  }
                }
              });
              path.stop();
            } else {
              path.skip();
            }
          }
        });
        state.exp.map(path => {
          if (t.isLogicalExpression(path.node.expression)) {
            processLogicalExp(path, state.opts.lazyTags);
          } else if (t.isCallExpression(path.node.expression)) {
            processCallExp(path);
          }
        })

        state.mainPlace.replaceWith(
          t.program([t.expressionStatement(state.renderReturn)])
        );
      }
    }
  };
}
