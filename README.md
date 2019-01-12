# parfunc

parfunc allows you to declare functions that can be used for parallel tasks and apply them to lists and sets of data

## Concepts

Parallelization of a programming task is complicated for a few rasons:

1. The mathematical foundations of algorithms are linear sequences of operations to perform, and so mathematical Turing machines are as well, so the foundational model of programming is not parallel.
2. There is no feedback from a compiler or from the source code syntax itself on whether or not a given function is safe to use in parallel, or even what degree of parallelism is possible.
3. The vast majority of languages in common use encourage mechanisms to make parallelism impossible (by those tools being easy) and discourage actually running in parallel (by those tools being difficult)

`parfunc` attempts to do three things to help this:

1. Make it simple to classify your functions' parallelization potential and validate this with fuzzing.
2. Provide a replacement set of core syntax to enable parallelization safely and succinctly
3. A managed pool of webworker threads to perform the parallel operations, and a judgement call on when it should be used (because of the high overhead of moving data in and out of the threads in Javascript, though there is a cost in all languages).

### Function purity

The first bar a function must pass to be safely parallelizable is its purity. Functions that change behavior depending on external state not based on the input parameters -- that reference some higher scope of state -- cannot be guaranteed to produce the same outputs across multiple threads and are therefore unsafe to parallelize. For instance, a function that performs a database lookup to decide if a particular feature is turned on may behave differently between machines if one of them could not query the database, or if the database value is updated mid-computation.

This isn't as onerous of a constraint as it might seem, however. Any state in use that is guaranteed constant during the life of the operations can be considered simply part of the function definition and make it pure, and unpure functions can return a pure function that can be used for a particular operation, such as using `.bind` to fix these parameters as constant arguments to it.

(Probably crib part of [lambda-js](https://github.com/dfellis/lambda-js) to force function purity, but don't need the syntactic sugar anymore.)

### Types of parallel operations

There are a few different classes of parallelizable operations:

1. Actions on completely separate pieces of data that have no relation to each other -- like Actors processing messages (eg, users updating their account configuration) or `array.map((v) => ...` operations on arrays of data. This is the easiest to parallelize.
2. Matrix-like operations that take table(s) of input information and compute a new value for an output index in an output table -- like matrix multiplication or `array.map((v, i, a) => ...` operations on arrays of data. This is the second easiest to parallelize.
3. Distilling sets of information into a single output due to some relationship they have with each other -- like computing the mean, standard deviation, etc, or concatenating strings, basically `array.reduce((accumulator, value) => ...` operations. This may need intermediate outputs to allow parallelization to occur and is the second hardest to parallelize.
4. Distilling sets of information into multiple outputs determined by examining the input data -- like building time-series indexes of events for different query patterns. Since the outputs are not known up front, multiple threads may want to update the same output at the same time, which will require some sort of mechanism (like a lock or queue) to do so. This is the hardest to parallelize.

For all of these, there are open and closed variants -- the input data may be fully known ahead of time and make this a closed form (like array operations), or the input may be continuously coming in from external sources (users updating their accounts, event streams, etc). There are also push and pull models for the relevant data, push being the model stream processing tends to use and pull for database queries.

When you have a large amount of data but only a small portion is relevant and the final computation is trivial, the DB SQL-style queries make the most sense and no compute parallelism is necessary, but when you have a large amount of computation to perform on your data or you basically need to consume all of the data, then the push model can make more sense as it can be easier to parallelize the data ingestion and compute operations.

This may not be an exhaustive set of parallel computation, but I believe it covers 90+% of the cases, and the four classes above can be reduced into the following statement: An input set `S` is converted into `n` operations that each produce `o` outputs that become a total output set `T`. For the first class `O(S) == O(n) == O(o) == O(T)`, for the second class `O(S)` may or may not be equal to `O(n)` while `O(n) == O(o) == O(T)`, for the third class `O(S)` may or may not equal `O(n)` while `O(n) != O(o)` and `O(o) == O(T) == 1`, and the final class has no guarantees at all on the equality between those different counts.

(Will show later that the fourth class of parallelization can be broken into a first class and second class that can be run simultaneously, but in sequence for any particular input.)

### Function arity

The number of input arguments (arity) on the pure function can constrain the parallelization possible.

* **0:** A pure function with no arguments is just a funny constant. No parallelization needed.
* **1:** With one argument only, this can be applied to the first class of parallelization trivially.
* **2:** With two arguments, some complications arise. If being applied to the second class of parallelization where one argument is all of the input date and the other is the index the output is going to, then it is also trivially parallelizable. If it is being applied to the third class of parallelization, then the function is essentially the same as a mathematical operator being applied to all data in the input set, and then whether the function is [commutative](https://en.wikipedia.org/wiki/Commutative_property), [associative](https://en.wikipedia.org/wiki/Associative_property), or neither is necessary to determine if the operation can be trivially parallelized, logarithmically parallelized, or not parallelized at all.
* **3:** Three arguments and above cannot be applied to a set of inputs in parallel except if the function is commutative, but then it should be possible to break it apart into a 'normal' two argument commutative function.

### Commutative and Associative binary input functions

A commutative function `f` must have the property that `f(a, b) == f(b, a)`, like `a + b == b + a`.

An associative function `g` has the property that the parenthesis grouping doesn't matter, but the high-level ordering *does* matter, eg `2 + (3 + 4) == (2 + 3) + 4`, or `g(a, g(b, c)) == g(g(a, b), c)`. A common operation that is associative but not commutative is string concatenation.

A reduce-like function that has a `commutative` and `associative` reducer function can simply divide the input payload across all available threads, combine those subsets in each thread, then pull the results back to the "main" thread and perform one last set of combines to get the final result.

A reduce-like function that is `associative` only can still be mostly parallelized in a logarithmic fashion by judicious use of parenthetic grouping:

```
a + b + c + d + ... + y + z
(a + b) + (c + d) + ... (y + z)
((a + b) + (c + d)) + ... (y + z)) or (ab + cd) + ... + yz)
```

And et cetera. The first set of parenthesis can be computed in parallel and placed into a new array in the same order and the process repeated until no more operations are required.

A reduce-like function that is `commutative` only *cannot* be parallelized because each successive operation in the reducer list depends on having the output of the prior call to work correctly, but if expensive it *can* be memoized in an argument-order-independent fashion and these answers can be shared between parallel independent computations if desired (fitting more in the `pull` type parallelism). Whether or not the memoization should be done depends on the likelihood that "collisions" are expected to occur.

## TODO

Implement the library