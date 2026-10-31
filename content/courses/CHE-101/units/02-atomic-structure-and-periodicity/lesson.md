## Why the atom needed a new mechanics

Lecture 2 of the source course tells the story in two experiments. Thomson (1897) deflected cathode rays with an electric field and showed they were light, negatively charged particles, the same whatever gas was in the tube: atoms are not indivisible. Rutherford, Geiger and Marsden (1911) fired α particles at gold foil; almost all passed through, a tiny fraction bounced back. The interpretation is quantitative: most of the atom is empty, and nearly all its mass sits in a nucleus of positive charge $+Ze$ about $10^{-14}$ m across, with $Z$ electrons of total charge $-Ze$ around it (notes, pages 1 and 4).

**Model.** Put the Coulomb force between a proton and an electron, $F = -\dfrac{e^2}{4\pi\varepsilon_0 r^2}$, into Newton's second law. An electron starting at rest $0.5$ Å from the nucleus reaches $r = 0$ in about $10^{-10}$ s, and an orbiting electron radiates its energy away and spirals in (notes, pages 5–6). Classical mechanics predicts that atoms do not exist. Since they do, the model is wrong at this scale, and quantum mechanics replaces it. Keep this pattern: a model, a prediction, an observation that contradicts it.

## Light as waves and as photons

Light is an electromagnetic wave with $c = \lambda\nu$. It is also delivered in packets, photons, of energy
$$E = h\nu = \frac{hc}{\lambda}, \qquad h = 6.626\times10^{-34}\ \text{J s}.$$
The photoelectric effect forces the second view (OpenStax 6.1). Light below a threshold frequency ejects no electrons from a metal however intense it is; above the threshold, the kinetic energy of the fastest electrons grows with frequency and not at all with intensity:
$$\text{KE}_{\max} = h\nu - \phi,$$
where $\phi$ is the work function of the metal. Intensity sets the number of photons per second and hence the number of electrons; frequency sets the energy of each.

**Example.** Light of wavelength $300$ nm falls on a surface whose work function is stated as $2.0$ eV (a model value for this example). With $hc = 1240$ eV nm, the photon energy is $1240/300 = 4.13$ eV, so $\text{KE}_{\max} = 4.13 - 2.0 = 2.1$ eV. Doubling the intensity doubles the number of electrons and leaves $2.1$ eV unchanged.

Atoms emit and absorb light only at particular wavelengths (line spectra). That is the observation the next model must explain.

## The hydrogen atom

**Model.** For a one-electron atom of nuclear charge $Z$ the allowed energies are
$$E_n = -\frac{Z^2 R_H}{n^2}, \qquad n = 1, 2, 3, \dots, \qquad R_H = 2.179\times10^{-18}\ \text{J}.$$
(OpenStax 6.2 writes the constant as $k$.) The zero of energy is the separated electron and proton; bound states are negative, and the ground state $n = 1$ has $E_1 = -R_H = -13.6$ eV. A photon is emitted when the electron drops from $n_i$ to $n_f < n_i$, with $h\nu = E_{n_i} - E_{n_f}$; absorption is the reverse. The ionisation energy of ground-state hydrogen is $R_H$ per atom.

**Example.** The $n = 4 \to 2$ transition: $\Delta E = R_H\left(\tfrac{1}{4} - \tfrac{1}{16}\right) = 0.1875\,R_H = 4.09\times10^{-19}$ J, so $\lambda = hc/\Delta E = 4.86\times10^{-7}$ m $= 486$ nm, the blue-green line of the Balmer series. Every transition ending on $n = 2$ lies in or near the visible; those ending on $n = 1$ are ultraviolet.

The energies come from the Schrödinger equation, which treats the electron as a wave (de Broglie: $\lambda = h/p$). Its solutions are **orbitals**, wavefunctions $\psi$ whose square gives the probability density of finding the electron. Each is labelled by three quantum numbers: $n$ (energy and size), $l = 0, \dots, n-1$ (shape: $s, p, d, f$ for $l = 0, 1, 2, 3$) and $m_l = -l, \dots, l$ (orientation). A fourth, $m_s = \pm\tfrac12$, is the electron's spin (OpenStax 6.3; lectures 4–6). An orbital is not a path. The Pauli exclusion principle allows at most two electrons per orbital, with opposite spins.

**Warning.** In hydrogen all orbitals with the same $n$ have the same energy; the $2s$ and $2p$ are degenerate. This is special to one-electron atoms and fails as soon as there is a second electron.

## Multi-electron atoms and configurations

With several electrons, each one feels the nucleus and the repulsion of the others. The notes summarise this as shielding: an electron in a penetrating orbital ($2s$ reaches closer to the nucleus than $2p$) feels a larger effective nuclear charge $Z_{\text{eff}}$ and is bound more tightly, so $2s$ lies below $2p$, $3s$ below $3p$ below $3d$, and $4s$ ends up close to $3d$ (lecture 7; OpenStax 6.4). The **aufbau** order of filling is $1s, 2s, 2p, 3s, 3p, 4s, 3d, 4p, \dots$; **Hund's rule** says electrons in a degenerate set occupy separate orbitals with parallel spins before pairing.

**Example.** Phosphorus ($Z = 15$): $1s^2\,2s^2\,2p^6\,3s^2\,3p^3$, written $[\text{Ne}]\,3s^2\,3p^3$, with three unpaired $3p$ electrons. Zinc(II): zinc is $[\text{Ar}]\,3d^{10}\,4s^2$, and $\ce{Zn^2+}$ loses the two $4s$ electrons to give $[\text{Ar}]\,3d^{10}$. Cobalt(II): $\ce{Co}$ is $[\text{Ar}]\,3d^7\,4s^2$, so $\ce{Co^2+}$ is $[\text{Ar}]\,3d^7$ with three unpaired electrons. In a neutral transition metal the occupied $3d$ orbitals lie below $4s$, so ionisation removes $4s$ first even though $4s$ filled first; this is the single most common slip in configurations. Chromium and copper are the standard exceptions to aufbau ($[\text{Ar}]\,3d^5\,4s^1$ and $[\text{Ar}]\,3d^{10}\,4s^1$); OpenStax 6.4 lists them.

How do we know orbital energies in a multi-electron atom? **Photoelectron spectroscopy** (lecture 8, page 3) shines X-rays of known energy $h\nu$ on a sample and measures the kinetic energies of ejected electrons: $h\nu = \text{IE} + \text{KE}$, exactly the photoelectric relation applied to atoms. Each occupied subshell gives one peak. Lithium gives two peaks ($1s$, $2s$); neon gives three ($1s$, $2s$, $2p$). The spectrum is the measurement; the configuration is the model that explains it.

## Periodic trends

**Definition (ionisation energy).** The minimum energy to remove an electron from a gaseous atom, $\ce{X(g) -> X+(g) + e-}$; the first IE refers to the most weakly bound electron, so $\text{IE} = -E$ of the highest occupied atomic orbital (lecture 8, page 1). It is always positive.

**Definition (electron affinity).** For $\ce{X(g) + e- -> X-(g)}$ with energy change $\Delta E$, the notes define $\text{EA} = -\Delta E$: positive when attaching an electron releases energy (Cl, $\text{EA} = +349$ kJ/mol), negative when it costs energy (N, $-7$ kJ/mol) (lecture 8, page 4). Check the sign convention of any source before comparing numbers.

Across a period, $Z$ rises while $n$ stays fixed: the outer electrons are pulled in, radii shrink and IE rises. Down a group, $n$ rises and the outer electron sits in a larger, better-shielded shell: radii grow and IE falls, despite larger $Z$ (lecture 8, page 2; OpenStax 6.5). Two irregularities are themselves evidence for subshells: boron's IE is below beryllium's because its outermost electron is in the higher $2p$, and oxygen's is below nitrogen's because the fourth $2p$ electron must pair, with the extra repulsion that costs. Electron affinities are largest for the halogens, whose added electron completes a $p$ subshell, and unfavourable for the noble gases, whose added electron would start a new shell.

**Example.** Order Al, Si, P, S by first IE. Across period 3 the trend predicts Al < Si < P < S, but the pairing glitch predicts S below P: Al < Si < S < P. Tabulated values agree, which is what makes the glitch a feature of the model rather than noise.

## What to carry forward

Three measurements (photoelectric effect, line spectra, photoelectron spectra), three models (photon, hydrogen energy levels, shielded orbitals), and one habit: ask which observation each model explains and which it would fail. Next unit: how these atoms share and transfer electrons to make bonds, and how the resulting molecules take their shapes.
