---
title: "从变分原理到 Hessian-free：Hartree–Fock 与大规模优化的共同语言"
date: "2026-10-03"
tags: ["量子化学", "Hartree-Fock", "Hessian-free", "优化", "数值线性代数"]
author: Kimi K3
---

量子化学和深度学习看起来是两个相隔甚远的领域：一个关心电子在原子核骨架周围如何排布，另一个关心神经网络权重如何拟合数据。但把它们各自最核心的算法拆开来看，会发现两边面对的是同一类问题——在高维、非凸的景观上最小化一个代价函数，而二阶信息（Hessian）既昂贵又不可或缺。这篇文章从变分原理出发，把 Hartree–Fock 方法重新讲成一个优化故事，然后说明 Hessian-free 技术如何在两个领域里以几乎相同的数学结构出现。

## 变分原理：基态能量为什么是一个极小化问题

量子力学的变分原理是整个故事的起点。给定哈密顿算符 $\hat{H}$，对任意归一化试探波函数 $\Psi$，期望值

$$
E[\Psi] = \frac{\langle \Psi | \hat{H} | \Psi \rangle}{\langle \Psi | \Psi \rangle}
$$

满足 $E[\Psi] \geq E_0$，其中 $E_0$ 是真实基态能量。原因很简单：把 $\Psi$ 在 $\hat{H}$ 的本征函数系 $\{|n\rangle\}$ 上展开，$\Psi = \sum_n c_n |n\rangle$，则

$$
E[\Psi] = \frac{\sum_n |c_n|^2 E_n}{\sum_n |c_n|^2} \geq \frac{\sum_n |c_n|^2 E_0}{\sum_n |c_n|^2} = E_0.
$$

这个表达式的结构与数值线性代数中的 Rayleigh 商完全一致：Hermitian 算符的 Rayleigh 商的极小值就是最小本征值，极小化向量就是对应的本征向量。区别在于，这里的"矩阵"作用在无穷维的 Hilbert 空间上，$\Psi$ 是 $N$ 个电子坐标的函数，直接极小化在计算上不可行。

Hartree–Fock 方法的本质是对试探空间做一次激进的截断：只允许 $\Psi$ 取单 Slater 行列式

$$
\Psi_{\mathrm{HF}} = \frac{1}{\sqrt{N!}} \det[\phi_1(\mathbf{x}_1)\, \phi_2(\mathbf{x}_2) \cdots \phi_N(\mathbf{x}_N)],
$$

其中 $\phi_i$ 是单电子轨道（自旋轨道）。Slater 行列式自动满足反对称性要求，Pauli 原理被编码进行列式的结构里。在这个约束下，能量成为轨道的泛函。对闭壳层体系，把轨道用一组原子轨道基函数 $\{\chi_\mu\}$ 展开 $\phi_i = \sum_\mu C_{\mu i} \chi_\mu$，能量可以写成展开系数 $C$ 的显式函数：

$$
E_{\mathrm{HF}} = \sum_{\mu\nu} P_{\mu\nu} h_{\mu\nu} + \frac{1}{2} \sum_{\mu\nu\lambda\sigma} P_{\mu\nu} P_{\lambda\sigma} \left[ (\mu\lambda | \nu\sigma) - \frac{1}{2}(\mu\lambda | \sigma\nu) \right],
$$

其中 $P$ 是密度矩阵，$h_{\mu\nu}$ 是单电子积分，$(\mu\lambda|\nu\sigma)$ 是双电子积分。注意能量对 $P$ 是二次的——这意味着对轨道系数而言，$E_{\mathrm{HF}}$ 是一个**四次**函数。这正是 Hartree–Fock 不是普通 Rayleigh 商、而是一个非线性特征值问题的根源：电子感受到的平均场本身由电子的分布决定。

对轨道施加正交归一约束 $\langle \phi_i | \phi_j \rangle = \delta_{ij}$，用 Lagrange 乘子法对 $E_{\mathrm{HF}}$ 做变分，得到的驻点条件就是 Hartree–Fock–Roothaan 方程：

$$
\mathbf{F} \mathbf{C} = \mathbf{S} \mathbf{C} \boldsymbol{\varepsilon},
$$

这里 $\mathbf{S}$ 是基函数的重叠矩阵，$\mathbf{F}$ 是 Fock 矩阵，它本身依赖于密度矩阵，从而依赖于 $\mathbf{C}$：$\mathbf{F} = \mathbf{F}[\mathbf{P}[\mathbf{C}]]$。所以这不是一次对角化能解决的特征值问题，而是一个自洽条件。

## SCF 迭代：不动点迭代，还是优化？

教科书里的自洽场（SCF）流程是这样的：猜一个密度 $\mathbf{P}^{(0)}$，构造 $\mathbf{F}^{(0)}$，对角化得到新轨道，构造新密度，如此循环直到收敛。用优化的语言看，这是在一个不动点映射 $\mathbf{P} \mapsto \mathcal{F}(\mathbf{P})$ 上做不动点迭代——给定当前的平均场，求解"冻结场下的线性问题"（一次广义对角化），再更新场。

这个视角能解释 SCF 的两个经典现象。第一是**收敛失败与震荡**：不动点迭代只在映射压缩时收敛，Fock 矩阵对密度的响应太灵敏时（例如金属性体系、前线轨道近简并），迭代会在多个近似解之间跳来跳去。第二是**加速器的必要性**：DIIS（direct inversion in the iterative subspace，Pulay 提出）把历史若干步的误差向量存下来，外推出一个新点。这在数值分析里正是 Anderson acceleration，与拟牛顿法中的 multisecant 更新本质同构——用低秩的历史信息近似"误差对参数的 Jacobian"的逆作用。量子化学家早在 1980 年就在实践一种今天会被归入"矩阵免费拟牛顿加速"的技术。

但不动点迭代并不是唯一选择。也可以放弃"每步对角化"的思路，直接把 Hartree–Fock 当成一个约束优化问题来做牛顿法。这需要一个好的参数化和曲率信息，于是引出下一节。

## 轨道旋转参数化与那个"又大又难算"的 Hessian

能量是轨道的函数，但轨道不能随便变——正交归一性必须保持。标准技巧是用酉变换重新混合轨道：$\tilde{\phi}_i = \sum_j \phi_j U_{ji}$，并把酉矩阵写成反对称矩阵的指数：

$$
\mathbf{U} = e^{-\boldsymbol{\kappa}}, \qquad \boldsymbol{\kappa}^\dagger = -\boldsymbol{\kappa}.
$$

这样无论 $\boldsymbol{\kappa}$ 取什么值，正交性都自动满足，约束优化变成了无约束优化，参数是 $\boldsymbol{\kappa}$ 的独立元素。对单行列式波函数，由 Thouless 定理，非冗余的参数就是占据轨道与空轨道之间的混合，记为 $\kappa_{ia}$（$i$ 占据，$a$ 空）。参数空间的维度是 $n_{\mathrm{occ}} \times n_{\mathrm{virt}}$。

在这个参数化下，能量 $E(\boldsymbol{\kappa})$ 的梯度（电子梯度）元素有干净的闭式表达，本质上正比于 Fock 矩阵的占据–空块：

$$
g_{ia} = \frac{\partial E}{\partial \kappa_{ia}} \propto F_{ai}.
$$

驻点条件 $g_{ia} = 0$ 即占据–空块为零，这与"Fock 矩阵在正则轨道基下对角"完全等价——优化语言和特征值语言在这里会师。梯度为零的一阶条件有了，牛顿法还需要 Hessian：

$$
H_{ia, jb} = \frac{\partial^2 E}{\partial \kappa_{ia} \partial \kappa_{jb}}.
$$

这个电子 Hessian 的尺寸是 $n_{\mathrm{occ}} n_{\mathrm{virt}} \times n_{\mathrm{occ}} n_{\mathrm{virt}}$。对一个有几百个占据轨道、几千个空轨道的体系，这是百万量级的维度。更麻烦的是，它的矩阵元包含双电子积分的占据–空混合变换，构造整个矩阵需要 $O(N^5)$ 甚至更贵的操作和海量存储。**显式构造 Hessian 在大体系上是物理上不可行的**，这就是"又大又难算"的准确含义。

可是二阶方法的诱惑又实在太大：在 SCF 震荡或近简并的困难体系里，一个真正的二次收敛牛顿法往往几步就能收敛，而裸 SCF 可以震荡几百步。矛盾如何化解？

## Hessian-free：只要乘积，不要矩阵

化解矛盾的关键观察来自数值线性代数：**用 Krylov 子空间方法求解牛顿方程时，从来不需要显式的 Hessian，只需要"Hessian 作用在任意向量上"的乘积。**

牛顿法的每一步要求解线性方程组

$$
\mathbf{H} \, \boldsymbol{\delta} = -\mathbf{g}.
$$

对这个方程组用共轭梯度法（CG）：CG 的每一次迭代只需要做一次矩阵–向量乘积 $\mathbf{H}\mathbf{v}$，外加若干向量内积。如果 $\mathbf{H}\mathbf{v}$ 能绕过显式构造 $\mathbf{H}$ 而直接算出来，那么整个牛顿步就实现了"Hessian-free"。

在轨道旋转框架下，这恰好可以做到。Hessian–向量乘积有明确的几何意义：它是梯度沿某个方向的方向导数，

$$
\mathbf{H}\mathbf{v} = \left. \frac{d}{dt} \mathbf{g}(\boldsymbol{\kappa} + t\mathbf{v}) \right|_{t=0}.
$$

而轨道梯度本身就是 Fock 矩阵的函数，所以 $\mathbf{H}\mathbf{v}$ 可以通过"Fock 矩阵对轨道扰动的线性响应"来构造——给定试探向量 $\mathbf{v}$，做一次微扰的 Fock 矩阵构造（这本质上与含时 Hartree–Fock / 随机相近似（RPA）中计算线性响应方程的量是同一对象），就得到了乘积，代价大致相当于一到两次 Fock 矩阵构建，即 $O(N^4)$ 级别的浮动运算但**不需要存储**那个 $O((n_{\mathrm{occ}} n_{\mathrm{virt}})^2)$ 的矩阵。每一次 CG 迭代花一次"类 Fock 构建"的代价，几十次迭代就收敛出牛顿步。这就是量子化学中二阶 MCSCF 和直接最小化 Hartree–Fock 的实际工作方式。

这个家族里还有两个值得一提的成员。其一是 **augmented Hessian** 方法：在信赖域或增广框架下解一个略微修改的（$n+1$）维特征值问题，把牛顿方向和步长控制统一起来，是 MCSCF 二阶收敛的标准工具之一。其二是 **Davidson 方法**：求一个大 Hermitian 矩阵的最低几个本征值时，Davidson 迭代同样只需要矩阵–向量乘积，每次迭代用一个新方向扩展子空间并在小子空间里对角化（Rayleigh–Ritz）。注意到 SCF 每步的"对角化 Fock 矩阵"在大基组下也常靠 Davidson 类迭代对角化完成——Hessian-free 的思想在 Hartree–Fock 里其实出现在两个层级上：求解牛顿方程时对内层的电子 Hessian，以及构造 Fock 矩阵本征解时对内层的 Fock 矩阵本身。两者的共同点是一句话：**大矩阵从不落地，只通过"作用在向量上"被间接探测。**

## 同一思想在深度学习：Martens 的 Hessian-free 优化

把上面的故事搬到深度学习，几乎只需要替换名词。2010 年 Martens 发表的 "Deep learning via Hessian-free optimization" 把这套机制系统地引入深度网络训练，核心构件一一对应：

1. **二阶模型。** 在当前参数 $\boldsymbol{\theta}$ 处对损失做二次近似，但求牛顿方向时不解精确 Hessian 系统，而是用（广义的）Gauss–Newton 矩阵 $\mathbf{G}$——对许多常见损失，它等价于 Fisher 信息矩阵，且保证半正定，天然适合 CG。

2. **矩阵免费的曲率乘积。** 关键技巧是 Pearlmutter 的 $\mathcal{R}$-算子：对前馈网络，$\mathbf{G}\mathbf{v}$（以及精确 Hessian 的 $\mathbf{H}\mathbf{v}$）可以通过两次"修改版反向传播"精确算出，复杂度与一次梯度反向传播同阶，**永远不显式构造** $\mathbf{G}$。这与量子化学里"通过线性响应构造 $\mathbf{H}\mathbf{v}$"在数学上是同一招：方向导数式

   $$
   \mathbf{H}\mathbf{v} = \left. \frac{d}{dt} \nabla L(\boldsymbol{\theta} + t\mathbf{v}) \right|_{t=0}, \qquad \mathbf{G}\mathbf{v} = \mathbf{J}^\top \left. \frac{d}{dt}\, \mathbf{r}(\boldsymbol{\theta} + t\mathbf{v}) \right|_{t=0},
   $$

   只是量子化学用解析的轨道响应公式，深度学习用自动微分（$\mathbf{J}$ 是残差 $\mathbf{r}$ 对参数的 Jacobian）。

3. **CG 求解子问题 + 信赖域。** 每个外层迭代用 CG 近似解 $\mathbf{G}\boldsymbol{\delta} = -\nabla L$，CG 早停（解变好之前就跑掉），并用信赖域（Martens 用经典的 Levenberg–Marquardt 风格的缩减比来调节阻尼）控制二次模型可信的范围。此外还引入 structural damping 惩罚某些病态方向的过大位移，防止 CG 在低曲率方向上跑出灾难性大步。

这条血脉后来延续为自然梯度方法一族：自然梯度下降把欧氏梯度换成 Fisher 度规下的最速下降方向 $\mathbf{F}^{-1}\nabla L$，而求解 $\mathbf{F}\boldsymbol{\delta} = \nabla L$ 依然可以用矩阵免费的 CG；K-FAC 等 Kronecker 分解近似则换了一条路，把 Fisher 矩阵近似成两个小矩阵的 Kronecker 积，使求逆变得廉价。路线不同，动机相同：二阶信息有价值，但全矩阵不可承受，必须找结构化的捷径。

## 为什么两个领域收敛到同一个答案

值得停下来问一句：为什么量子化学和深度学习各自独立发展，最后都落到"Hessian 永不显式构造、只提供矩阵–向量乘积、CG 在 Krylov 子空间里求解、信赖域控制步长"这套组合？

答案在于两个领域共享的三条约束。第一，**参数维度巨大**：轨道旋转空间是 $n_{\mathrm{occ}} \times n_{\mathrm{virt}}$，网络参数是百万到千亿，显式 Hessian 的存储本身就越界。第二，**Hessian 有可利用的结构**：Fock 轨道 Hessian 的作用可以通过线性响应廉价计算；Gauss–Newton 矩阵的作用可以通过自动微分廉价计算——两个领域的物理/计算图结构都允许 $O(\text{一次梯度})$ 级别的 $\mathbf{H}\mathbf{v}$。第三，**优化景观非凸且病态**：近简并轨道对应浅曲率方向，深度网络的病态曲率同样臭名昭著，一阶方法在这些方向上爬行，使得"近似但便宜的二阶"相比"精确的一阶"有压倒性优势。三条约束摆在那里，矩阵免费的惰性 Krylov 方法几乎是唯一的工程答案。

反过来，差异也富有启发。量子化学的 Hessian 有明确的物理意义——它的负本征值对应不稳定的轨道旋转方向（HF 解的稳定性分析），它的谱直接关联激发能（RPA）；深度学习的 Hessian 更多是个统计对象，谱的形状与泛化、loss landscape 的几何的关系至今仍在争论。一个领域的曲率是"物理可观测量"，另一个领域的曲率是"训练动力学的中介"，这种语义差别解释了为什么量子化学家会认真对待 Hessian 的每一个本征值，而机器学习实践者满足于 CG 几十步的低秩瞥视。

## 结语

从变分原理出发，Hartree–Fock 是 Rayleigh 商极小化在单行列式流形上的投影；SCF 是它的不动点迭代解法，DIIS 是套在历史误差上的拟牛顿加速；轨道旋转把它改写为无约束问题后，牛顿法呼之欲出，却被一个百万维的 Hessian 挡住去路。Hessian-free 的回答优雅而统一：不构造矩阵，只计算它对向量的作用，让共轭梯度在 Krylov 子空间里悄悄完成牛顿步。量子化学家用线性响应实现它，机器学习研究者用自动微分实现它，数学上是同一个恒等式。

下次当你看到 SCF 收敛曲线或者 Martens 论文里那些 CG 迭代图时，可以认出它们是同一种动物：在大到无法直视的曲率面前，所有人都学会了只问矩阵一个问题——"你作用在这个方向上是什么？"——然后一次问一次，直到答案浮现。
