## The problem

The MIT course opens with a question older than cognitive science. Lecture 1 puts John Stuart Mill's version on a slide (1843): why is a single instance, in some cases, sufficient for a complete induction, while in others myriads of concurring instances, without a single exception known or presumed, go such a very little way towards establishing a general proposition? Whoever can answer that, Mill says, has solved the problem of induction (lecture 1, slide 17).

**Definition (deduction and induction).** In a deductive argument the conclusion follows necessarily from the premises: Socrates is a man, all men are mortal, so Socrates is mortal. In an inductive argument the conclusion follows "with more or less probability"; its strength depends on the meanings of the terms and on other knowledge available, so evaluating an inductive argument is not purely formal (lecture 1, slides 11 and 14). From "Socrates is 47" and "Socrates is a man" nobody concludes that all men are 47, yet from one squirrel and one gorilla with avian flu people readily generalise to horses (slide 24).

The lecture's inventory of everyday induction (slides 23–27) is the course's syllabus in miniature: generalising from examples, diagnosing causes from effects (a positive mammogram at age 40), learning words from a few instances, resolving ambiguous percepts, perceiving causality. The two ingredients of any computational account, the lecture says, are knowledge representation and statistics (slide 18).

## Three levels of description

**Definition (Marr's three levels).** Level 1, the *computational theory*: what is the goal of the computation and what is the logic by which it is carried out? Level 2, *representation and algorithm*: how is information represented and processed to achieve the goal? Level 3, *implementation*: how is the computation realised in physical or biological hardware? (lecture 1, slide 43; lecture 2, slide 27.)

Almost everything in this course lives at level 1. That is a strength and a limitation: a level-1 model that fits behaviour says what problem the mind is solving and how well, not what procedure or tissue solves it. The department's conventions exist to police the difference.

Lecture 2 spells out the level-1 and level-2 questions for concept learning (slide 28). Level 1: what is a concept, what does it mean to learn one successfully, what kinds of concepts can be learned, under what conditions, from how much data, and what must be assumed for learning to succeed? Level 2: how are objects and concepts represented, what memory and time does an algorithm need, and which concepts does it learn most easily?

## Concept learning as search

**Model (concept learning, level 1).** A concept is a rule dividing objects into positive and negative instances. The learner receives $N$ labelled examples and a hypothesis space $H$ of candidate rules, and must return a hypothesis consistent with the examples that, in some sense to be fixed, is good (lecture 2, slide 29). In the simplest representation (slide 30) objects are binary feature vectors $x\in\{0,1\}^k$ and hypotheses are conjunctions, written as patterns such as $*\,1\,*\,*\,1\,*$ meaning "$f_2$ and $f_5$".

Two success criteria make "good" precise.

**Definition (identification in the limit).** The learner converges to the true rule, if it lies in $H$, as $N\to\infty$ (slide 29). For conjunctions this is cheap: start from the first positive example as the most specific hypothesis and, at each positive example that the current hypothesis rejects, replace the disagreeing literals by $*$. Each such mistake removes at least one of the $k$ literals, so at most $k$ mistakes occur, and negative examples are never needed (slide 42).

**Definition (probably approximately correct).** A hypothesis $h$ with true error $\mathrm{err}(h)=\Pr_x[h(x)\ne c(x)]$ is approximately correct if $\mathrm{err}(h)\le\varepsilon$. A learning method is PAC if, with probability at least $1-\delta$ over the random training sample, it returns an approximately correct hypothesis (slides 47 and 51). The true rule need not be in $H$ and need not be found; what is required is that a hypothesis which looks perfect on the training sample is unlikely to be bad on fresh examples from the same distribution.

**Proposition (sample complexity of a finite hypothesis space).** Let $H$ be finite and suppose the training examples are drawn independently from the same distribution that will generate future examples. If $N\ge\frac1\varepsilon\big(\ln|H|+\ln\frac1\delta\big)$, then with probability at least $1-\delta$ every $h\in H$ consistent with the $N$ examples has $\mathrm{err}(h)\le\varepsilon$.

**Proof.** Call $h$ bad if $\mathrm{err}(h)>\varepsilon$. A fixed bad $h$ agrees with the true rule on one random example with probability less than $1-\varepsilon$, so it is consistent with all $N$ independent examples with probability less than $(1-\varepsilon)^N\le e^{-\varepsilon N}$. There are at most $|H|$ bad hypotheses, so by the union bound the probability that *some* bad hypothesis survives is less than $|H|e^{-\varepsilon N}$, which is at most $\delta$ exactly when $N\ge\frac1\varepsilon(\ln|H|+\ln\frac1\delta)$. $\square$

The slide states the bound (slide 51): $N$ grows as $\varepsilon$ shrinks, as the required confidence grows, and with $\ln|H|$. The proof shows where "uniformity of nature" enters: training and test examples must come from the same distribution. Lecture 1 is explicit that PAC is a modern partial answer to Hume which "still requires uniformity of nature" (slide 49).

**Example (counting hypothesis spaces).** Over $k$ binary features, a conjunction specifies each feature as required true, required false or irrelevant, so there are $3^k$ conjunctions and $\ln|H|=k\ln3$: linear in $k$. The space of *all* Boolean concepts has $2^{2^k}$ members, so $\ln|H|=2^k\ln2$ and the bound becomes useless. This is the content of "learning with no bias is impossible" (slide 58): with $H$ unrestricted, every labelling of the unseen objects is consistent with the data, and the PAC argument offers no comfort.

## Inductive bias and the philosophers' problems

**Definition (inductive bias).** Constraints on the hypotheses a learner will consider, or preferences among them (slide 58). Restricting $H$ is the crudest form; later units replace it with a prior over a rich space.

Where does a good bias come from? Lecture 1 walks through the philosophy. Hume: induction can be justified only on the assumption that the future resembles the past, and that assumption cannot itself be justified inductively (slide 48). Goodman's new riddle (slide 50): some hypotheses are confirmed by their instances ("all pieces of copper conduct electricity") and some are not ("all men in this room are third sons"), and the difference is not syntactic, because "all emeralds are green" and "all emeralds are grue" (green if observed before $t$, blue otherwise) have the same logical form. The first response, prefer simpler or parameter-free hypotheses, fails because green and grue are symmetric under redescription: to a speaker whose primitives are grue and bleen, "green" is the gerrymandered term (slide 53). Goodman's own answer is *entrenchment*: predicates that have supported successful inductions before are projectible; the lecture's gloss is that entrenchment may come from experience but may also derive from a causal theory, and "theory supported by experience seems best" (slide 70). The lecture's curve-fitting slide (slide 58) is the quantitative face of the same problem, taken up in unit 5.

## What the search view leaves open

Lecture 2 closes with what rigorous learnability analysis explains and what it does not (slide 65): it shows when and why learning can work and gives a formal basis for Occam's razor, but it does not say where hypothesis spaces come from, why some concepts are more natural than others, how to handle uncertainty, or how to learn quickly and reliably with very flexible spaces (slides 60 and 65). These are the questions Bayesian models take up from unit 2.

The web book's Introduction makes the same move from the modern side: mental representations as *generative models*, theory-like descriptions of how observations are produced that can be interrogated to answer many questions, with probability theory as the calculus for choosing among the ways the data could have arisen. Read it after the slides.

**Warning (department convention).** From this unit on, every claim you write is one of four kinds, and you label it. *Model behaviour*: what the computational theory predicts. *Measurement*: what an experiment recorded, from whom, how. *Experimental evidence*: what the correspondence between the two shows, and at which of Marr's levels. *Causal claim*: what mechanism is asserted. A PAC bound is model behaviour about an idealised learner; a child learning a word from three examples is a measurement; "the child's generalisation matches the model" is level-1 evidence; "the child computes a posterior" is a causal claim that nothing so far licenses.

## What to carry forward

Induction is the problem; a computational-level theory states it and its ideal solution without committing to mechanism. Concept learning as search gives two success criteria, and the sample-complexity bound shows that learning needs a restricted hypothesis space and an i.i.d. assumption. Where a good bias comes from (Goodman, entrenchment, theories) is the question the Bayesian framework answers with priors over structured hypothesis spaces. Next unit: Bayesian inference as a model of cognition, from coins to the number game.
