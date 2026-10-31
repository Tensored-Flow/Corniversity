## From hypothesis spaces to degrees of belief

Unit 1 left two questions open: how to handle uncertainty, and where biases come from. Lecture 8 answers the first by making belief quantitative. Its argument (slides 18–19): if degrees of belief are real numbers, agree qualitatively with common sense and are consistent (every route to a conclusion gives the same answer; all evidence is used; equivalent knowledge gets equivalent belief), Cox's theorem makes them a probability measure; the pragmatic version is the Dutch book. The payoff the lecture emphasises is a theory of learning: "a common currency for combining prior knowledge and the lessons of experience".

**Model (beliefs as probabilities).** A learner's state of knowledge about a set of mutually exclusive, exhaustive hypotheses $H$ is a probability distribution $P(h)$; learning from data $D$ is the move from $P(h)$ to $P(h\mid D)$.

## Bayes' rule and its reading

**Definition (prior, likelihood, posterior, evidence).** For data $D$ and hypothesis $h$,
$$P(h\mid D)=\frac{P(D\mid h)\,P(h)}{P(D)},\qquad P(D)=\sum_{h'\in H}P(D\mid h')\,P(h'),$$
where $P(h)$ is the prior, $P(D\mid h)$ the likelihood, $P(h\mid D)$ the posterior and $P(D)$ the evidence or marginal likelihood (lecture 8, slides 16 and 22). It follows in one line from the product rule (slide 17). The lecture's reading (slide 21): $P(h\mid D)$ is high when the hypothesis is plausible, strongly predicts the data, and the data are surprising.

**Model (odds form).** For two hypotheses,
$$\frac{P(h_1\mid D)}{P(h_2\mid D)}=\frac{P(D\mid h_1)}{P(D\mid h_2)}\cdot\frac{P(h_1)}{P(h_2)}:$$
posterior odds equal the likelihood ratio (Bayes factor) times the prior odds (slide 39). The evidence cancels, so pairwise comparisons are easy even when $H$ is large.

## Coins

Lecture 8 treats hypotheses as *generative processes* for the data (slide 32): a fair coin, a coin of unknown weight $\theta$, a Markov model, each drawn as a graphical model (slide 33). On HHTHT, "fair" versus "always heads" has likelihoods $1/2^5$ and $0$: one tail refutes the deterministic hypothesis (slide 40). On HHHHH the likelihood ratio is $32$ for the trick coin, and whether that convinces you depends on prior odds, which the lecture traces to implicit theories (slide 44): a coin rigged for heads is easy to imagine, a coin rigged to produce HHTHT is not, so HHHHH is suspicious although both sequences have probability $1/32$ under a fair coin.

The web book's *Learning About Coins* uses a trick coin of weight $0.95$ and a prior of $1/1000$. Each head multiplies the odds by $0.95/0.5=1.9$: after five heads the posterior odds are about $0.025$; after ten, about $0.61$, roughly even; after fifteen, about $15$. The book reads the speed of the shift as a diagnostic of the prior: ten to fifteen heads for most people places their trick-coin prior between about $1/100$ and $1/10{,}000$. That is *model behaviour* laid against an informal observation about people, not yet a measurement.

## Infinitely many hypotheses: learning a weight

Lecture 11 (file oct_14_2004_fin.pdf; see the source record on file names) makes each weight $\theta\in[0,1]$ a hypothesis (slide 3). Five heads in ten flips suggests $\theta=0.5$; four heads and six tails suggests something "closer to 50% than to 40%", because of prior knowledge (slide 4).

**Model (Beta–Bernoulli learning).** Likelihood $P(D\mid\theta)=\theta^{N_H}(1-\theta)^{N_T}$; prior $\theta\sim\mathrm{Beta}(F_H,F_T)$, with density proportional to $\theta^{F_H-1}(1-\theta)^{F_T-1}$; posterior $\theta\mid D\sim\mathrm{Beta}(N_H+F_H,\,N_T+F_T)$ (slide 14).

**Proof.** The posterior density is proportional to likelihood times prior, $\theta^{N_H+F_H-1}(1-\theta)^{N_T+F_T-1}$, which is the Beta kernel with the stated parameters; the normalising constant is $\Gamma(N_H+F_H+N_T+F_T)/\big(\Gamma(N_H+F_H)\Gamma(N_T+F_T)\big)$. $\square$

A prior whose posterior has the same functional form is *conjugate* (slide 18); the prior parameters read as fictitious observations (slide 7). Since the mean of $\mathrm{Beta}(\alpha,\beta)$ is $\alpha/(\alpha+\beta)$, the posterior predictive is
$$P(\text{next flip is H}\mid D)=\mathbb E[\theta\mid D]=\frac{N_H+F_H}{N_H+N_T+F_H+F_T}.$$
The lecture's examples (slides 28–29): with $F=\{1000,1000\}$ and four heads in ten flips the prediction is $1004/2010=49.95\%$; with $F=\{3,3\}$ it is $7/16=43.75\%$; for a thumbtack with $F=\{4,3\}$ after two heads, $6/9=67\%$; with no prior at all, two heads give $2/2=100\%$, which is why "some prior knowledge is always necessary to avoid jumping to hasty conclusions".

**Warning.** A flat prior is not the absence of assumptions. $\mathrm{Beta}(1,1)$ is a definite claim about weights, the hypothesis space $[0,1]$ is itself a strong commitment, and the empty prior gives the absurd 100%.

## Where priors come from

The tempting answer, experience with other coins, fails inspection (slides 30–33): nobody has seen two thousand flips, the prior is smoother and stronger than raw experience justifies, and ten flips of each of two hundred coins should teach something different from two thousand flips of one. A *theory* ("coins are manufactured by a standardized procedure that is effective but not perfect"; tacks are made to looser standards) explains all three.

**Model (hierarchical prior).** Put a higher-level variable above $\theta$: is this coin fair or unfair? With $P(\mathrm{fair})=0.99$, $\theta\mid\mathrm{fair}\sim\mathrm{Beta}(1000,1000)$ and $\theta\mid\mathrm{unfair}\sim\mathrm{Beta}(1,1)$, twenty-five heads in a row give posterior odds for fairness of about $9\times10^{-5}$ (slide 37). Here $P(D\mid\mathrm{unfair})=\int_0^1\theta^{25}\,d\theta=1/26$, while $P(D\mid\mathrm{fair})=\prod_{i=0}^{24}\frac{1000+i}{2000+i}\approx1.16\times2^{-25}\approx3.5\times10^{-8}$; the Bayes factor is about $9\times10^{-7}$ and the prior odds of $99$ bring it to $9\times10^{-5}$ (derived; the slide states the result). Evidence propagates up: the flips change beliefs about $\theta$ and, through $\theta$, about the coin's kind.

## The number game

Lecture 13 (oct_21_2004_fin.pdf) applies the same machinery to concepts. Task (slide 13): see one or more positive examples of a number concept, judge whether other numbers belong. Phenomena (slide 18): generalisation can look graded or all-or-none, and people learn from a few positive examples. Tenenbaum's model (slide 11): a concept is a pointer to a set, and learning acquires a probability distribution over possible sets.

**Model (Bayesian concept learning).** $H$ is a space of candidate extensions $h\subseteq\{1,\dots,100\}$: mathematical properties, approximate magnitudes, raw intervals (slides 20 and 24). Given examples $X=\{x_1,\dots,x_n\}$, the posterior is $p(h\mid X)\propto p(X\mid h)\,p(h)$ (slide 36).

**Proposition (size principle).** If examples are sampled independently and uniformly from the true extension (strong sampling), then
$$p(X\mid h)=\begin{cases}|h|^{-n},& X\subseteq h,\\ 0,&\text{otherwise.}\end{cases}$$

**Proof.** Under $h$, each example is one of $|h|$ equally likely numbers, so it has probability $1/|h|$ if it lies in $h$ and $0$ otherwise; independence multiplies the $n$ factors. $\square$

Smaller consistent hypotheses receive higher likelihood, exponentially more so as $n$ grows (slide 26). The web book calls this *implicit negative evidence*: a large hypothesis could have produced many other examples, whose absence counts against it. The size principle is a fact about the likelihood, not a prior preference for simplicity; the prior still has work to do, namely assigning near-zero probability to unnatural hypotheses such as "multiples of 10 except 50 and 70" (slide 31). The subset principle (pick the smallest consistent set) is its all-or-none limit (slide 30).

**Model (hypothesis averaging).** The probability that a new number $y$ belongs to the concept is
$$P(y\in C\mid X)=\sum_{h\in H:\,y\in h}p(h\mid X)$$
(slide 39). A broad posterior over many hypotheses of similar size yields a similarity gradient; a posterior concentrated on one much smaller hypothesis yields an all-or-none rule (slide 44).

**Example (a four-hypothesis space).** Take $H=\{$even numbers ($|h|=50$), multiples of 10 ($10$), powers of two ($\{2,4,8,16,32,64\}$, $6$), the interval 50–60 ($11$)$\}$ with a uniform prior. After $X=\{16\}$ only "even" and "powers of two" survive, with likelihoods $1/50$ and $1/6$, so $p(\text{powers of two}\mid X)=\frac{1/6}{1/6+1/50}=\frac{50}{56}\approx0.89$ and $p(\text{even}\mid X)\approx0.11$. Hypothesis averaging gives $P(32\in C)=1$, $P(20\in C)\approx0.11$, $P(15\in C)=0$: graded, already favouring the small hypothesis. After $X=\{16,8,2,64\}$ the likelihood ratio is $(50/6)^4\approx4800$, so $p(\text{powers of two}\mid X)\approx0.9998$ and $P(20\in C)\approx2\times10^{-4}$: the gradient has become a rule. Slide 43 sets the model's profiles beside human judgements for six example sets (60; 60, 80, 10, 30; 60, 52, 57, 55; 16; 16, 8, 2, 64; 16, 23, 19, 20); the plots are removed from the public PDF, so this lesson quotes no values, and slide 14 records twenty participants.

**Warning (four kinds of statement).** The computed profiles are *model behaviour*. Twenty participants' ratings are a *measurement*. "The profiles match" is *experimental evidence* at Marr's computational level. "People compute posteriors over hypotheses" would be a *causal claim*, and nothing in this unit supports it; a similarity model or a distance heuristic also gives graded profiles for a single example, and distinguishing the models needs the example sets on which they disagree.

## Lab

The lab `bayesian-concept-learning` implements the number game on an editable hypothesis space. Predict the profiles for $\{16\}$ and $\{16,8,2,64\}$ before running; then replace $|h|^{-n}$ by $|h|^{-1}$ and watch the rule disappear; then give an unnatural hypothesis a non-negligible prior and watch the model overfit. The comparison profile shown is synthetic, labelled as such, not human data.

## What to carry forward

Degrees of belief that behave like probabilities make Bayes' rule a theory of learning; posterior odds are the likelihood ratio times the prior odds. Conjugate priors make parameter learning explicit and show that having no prior is not an option; hierarchical priors say where priors come from. In concept learning the size principle follows from the sampling assumption, hypothesis averaging turns a posterior into generalisation, and the posterior's breadth decides whether generalisation looks graded or rule-like. Next unit: generative and graphical models, dependence, intervention and explaining away.
