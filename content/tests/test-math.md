+++
title = 'Test Math'
+++

## Math
### Inline
Lorem ipsum dolor sit amet, consectetur adipiscing elit. \
Aenean sagittis porttitor nisl, $a^*=x-b^*$ at congue sem rutrum lobortis. \
Aenean sagittis porttitor nisl, `a^*=x-b^*` at congue sem rutrum lobortis. \
Phasellus suscipit libero odio, sed vulputate nisi euismod eu.

### Block
$$
\begin{aligned}
KL(\hat{y} || y) &= \sum_{c=1}^{M}\hat{y}_c \log{\frac{\hat{y}_c}{y_c}} \\
JS(\hat{y} || y) &= \frac{1}{2}(KL(y||\frac{y+\hat{y}}{2}) + KL(\hat{y}||\frac{y+\hat{y}}{2}))
\end{aligned}
$$

```txt {#MathCodeCompare}
\begin{aligned}
KL(\hat{y} || y) &= \sum_{c=1}^{M}\hat{y}_c \log{\frac{\hat{y}_c}{y_c}} \\
JS(\hat{y} || y) &= \frac{1}{2}(KL(y||\frac{y+\hat{y}}{2}) + KL(\hat{y}||\frac{y+\hat{y}}{2}))
\end{aligned}
```
