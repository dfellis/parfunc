// The AsyncFunction constructor for some reason wasn't added to the Global scope
const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor

// The Arrow functions are mostly regular functions with `this` pre-bound
const ArrowFunction = function ArrowFunction(...args) {
  return new Function(...args).bind(global)
}

// After the source function is properly parsed, construct the new pure function with one of the
// following constructor functions
const funcConstructors = {
  '^async': AsyncFunction,
  '^function*': Generator, // TODO: Just error on these? Iterators are inherently non-parallel
  '^function': Function,
  '=>': ArrowFunction,
}

// This function parses the source of the provided function and returns an object with an array
// of variable names, the function body, and which constructor to rebuild it in.
const parseFunc = (f) => {
  // First get the source code 
  const funcStr = f.toString()
  // Determine the relevant constructor function
  const FuncConstructor = Object.keys(funcConstructors)
    .filter(matcher => funcStr.match(new RegExp(matcher)))[0]
  
  if (FuncConstructor === Function) {
    // TODO: Make this no-semicolon-safe
    return {
      constructor: 'Function',
      args: funcStr.replace(/\n/gm, '')..replace(/^function [^\(]*\(([^\)]*)\).*/, '$1'),
      expression: funcStr.replace(/\n/gm, '').replace(/^function [^(]*\([^)]*\) {(.*)}/, '$1'),
    }
  }

  if (FuncConstructor === ArrowFunction) {
    // TODO: Writing a parser for this will suck.
    // Maybe I just just depend on a real JS parser
    return null
  }

  // etc
  return null
}


const pure = (f) => {
  if (f.pure) return f
  // TODO: Implement the function purifier
  f.pure = true
  return f
}

const commutative = (f) => {
  if (f.commutative) return f
  const outF = pure(f)
  outF.commutative = true
  return outF
}

const associative = (f) => {
  if (f.associative) return f
  const outF = pure(f)
  outF.associative = true
  return outF
}

const commutativeAssociative = (f) => {
  return associative(commutative(f))
}

module.exports = {
  pure,
  p: pure,
  commutative,
  c: commutative,
  associative,
  a: associative,
  commutativeAssociative,
  ca: commutativeAssociative,
  fullyParallel: commutativeAssociative,
  fp: commutativeAssociative,
  f: commutativeAssociative,
}
