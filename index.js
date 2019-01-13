// The AsyncFunction constructor for some dumb reason was not added to the Global scope
const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor

// After the source function is properly parsed, construct the new pure function with one of the
// following constructor functions
const funcConstructors = {
  'async': AsyncFunction,
  'function*': Generator, // TODO: Just error on these? Iterators are inherently non-parallel
  'function': Function,
  '=>': Function, // TODO: Make something special for these? They behave slightly differently...
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
