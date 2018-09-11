'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

exports.default = function (babel) {
  var t = babel.types;

  function parseAsString(expression) {
    var ast = {
      type: 'Program',
      body: [t.expressionStatement(expression)]
    };
    var code = babel.transformFromAst(ast).code;
    if (code.endsWith(';')) {
      code = code.slice(0, code.length - 1);
    }
    return code;
  }
  function processLogicalExp(path, lazyTags) {
    var exp = path.node.expression;
    var body = exp.right;
    //unsupported currently
    if (!t.isJSXElement(body)) {
      return false;
    } else {
      //check if skip required inside expression: possible usecase for dynamic element
      var tag = body.openingElement.name.name;
      if (lazyTags.indexOf(tag) != -1) {
        path.remove();
        return false;
      }
    }
    var logicType = exp.operator;
    var logic = exp.left;
    var stringexp = parseAsString(exp.left);
    //create pseudo element
    var pseudo = t.jSXIdentifier('PLUGIN-CONDITION');
    var pseudoDataAttr = t.jSXAttribute(t.jSXIdentifier('data'), t.stringLiteral(stringexp));
    var pseudoTypeAttr = t.jSXAttribute(t.jSXIdentifier('type'), t.stringLiteral(logicType));
    var pseudoOpen = t.jSXOpeningElement(pseudo, [pseudoDataAttr, pseudoTypeAttr], false);
    var pseudoClose = t.jSXClosingElement(t.jSXIdentifier('PLUGIN-CONDITION'));
    var pseudoEle = t.jSXElement(pseudoOpen, pseudoClose, [body]);
    path.replaceWith(pseudoEle);
  }
  function processCallExp(path) {
    var exp = path.node.expression;

    if (t.isCallExpression(exp) && exp.callee.property.name == 'map') {
      var object = exp.callee.object;
      var propPath = [];
      while (t.isMemberExpression(object)) {
        propPath.unshift(object.property.name);
        object = object.object;
      }
      //object should be an identifier if not a member exp
      propPath.unshift(object.name);
      var type = exp.arguments[0].params[0].name;
      var body = exp.arguments[0].body.body[0].argument;
      var prop = propPath.join('.');
      //create pseudo element
      var pseudo = t.jSXIdentifier('PLUGIN-LOOP');
      var pseudoDataAttr = t.jSXAttribute(t.jSXIdentifier('data'), t.stringLiteral(prop));
      var pseudoTypeAttr = t.jSXAttribute(t.jSXIdentifier('type'), t.stringLiteral(type));
      var pseudoOpen = t.jSXOpeningElement(pseudo, [pseudoDataAttr, pseudoTypeAttr], false);
      var pseudoClose = t.jSXClosingElement(t.jSXIdentifier('PLUGIN-LOOP'));
      var pseudoEle = t.jSXElement(pseudoOpen, pseudoClose, [body]);
      path.replaceWith(pseudoEle);
    }
  }

  return {
    visitor: {
      Program: function Program(path, state) {
        //init state variables
        state.importProps = {};
        state.opts.lazyTags = state.opts.lazyTags || [];
        Object.assign(state, { importProps: {}, exp: [], renderReturn: null, mainPlace: path });
      },
      ImportDeclaration: function ImportDeclaration(path, _ref) {
        var importProps = _ref.importProps;

        var specifiers = path.node.specifiers;
        var loc = path.node.source.value;
        var _iteratorNormalCompletion = true;
        var _didIteratorError = false;
        var _iteratorError = undefined;

        try {
          for (var _iterator = specifiers[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
            var obj = _step.value;

            importProps[obj.local.name] = loc;
          }
        } catch (err) {
          _didIteratorError = true;
          _iteratorError = err;
        } finally {
          try {
            if (!_iteratorNormalCompletion && _iterator.return) {
              _iterator.return();
            }
          } finally {
            if (_didIteratorError) {
              throw _iteratorError;
            }
          }
        }

        path.remove();
      },
      Class: function Class(path, state) {
        path.traverse({
          ClassMethod: function ClassMethod(path) {
            if (path.node.key.name === 'render') {
              var returnNode = path.node.body.body.filter(function (obj) {
                return t.isReturnStatement(obj);
              });
              state.renderReturn = returnNode[0].argument;
              path.traverse({
                JSXExpressionContainer: function JSXExpressionContainer(path) {
                  state.exp.unshift(path);
                },
                JSXOpeningElement: function JSXOpeningElement(path) {
                  var tag = path.node.name.name;
                  if (state.importProps.hasOwnProperty(tag)) {
                    path.node.attributes.push(t.jSXAttribute(t.jSXIdentifier('cust-loc'), t.stringLiteral(state.importProps[tag])));
                  }
                }
              });
              path.stop();
            } else {
              path.skip();
            }
          }
        });
        state.exp.map(function (path) {
          if (t.isLogicalExpression(path.node.expression)) {
            processLogicalExp(path, state.opts.lazyTags);
          } else if (t.isCallExpression(path.node.expression)) {
            processCallExp(path);
          }
        });

        state.mainPlace.replaceWith(t.program([t.expressionStatement(state.renderReturn)]));
      }
    }
  };
};