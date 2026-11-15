# Change Log

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

# 0.2.0 (2026-11-15)

### Bug Fixes

* **application:** keep a thread's details on screen across a refresh ([#19](https://github.com/canonical/docket/issues/19)) ([dfb9b27](https://github.com/canonical/docket/commit/dfb9b274d9bf0c566b41fc0cabbfe2b3a89d5384))
* **application:** keep keys off while the pane is too narrow ([#24](https://github.com/canonical/docket/issues/24)) ([8d080f4](https://github.com/canonical/docket/commit/8d080f4e91d20045ec01fda48995b128df38d6b0))
* **github:** count a merge once, not as a merge and a close ([#32](https://github.com/canonical/docket/issues/32)) ([a8fccca](https://github.com/canonical/docket/commit/a8fccca4490bc94ac5fc5ef283ae633be341bde5))
* **inbox:** treats freshness warnings as optional ([#77](https://github.com/canonical/docket/issues/77)) ([d58703a](https://github.com/canonical/docket/commit/d58703a16a0e1ba62b48e0c4b325124a0d397ad3))
* **owed:** sort waits by working time overdue ([#66](https://github.com/canonical/docket/issues/66)) ([0677a23](https://github.com/canonical/docket/commit/0677a236f9ac7f9e01b32b5ccf3507fe39b18035))
* **scripts:** keep the gate's self-tests out of the caller's repository ([#15](https://github.com/canonical/docket/issues/15)) ([43f7b1a](https://github.com/canonical/docket/commit/43f7b1a0f98da0cec8ffef1ed4a80c1c43ff524b))
* settle the refresh stages and status line after review ([#35](https://github.com/canonical/docket/issues/35)) ([d1523d9](https://github.com/canonical/docket/commit/d1523d9f76db988c789feb5d2e127dfbd04d1761))
* **ui:** draw the terminal's own theme colours ([#64](https://github.com/canonical/docket/issues/64)) ([174547b](https://github.com/canonical/docket/commit/174547b222cee86a0bc3ca507e91c2aedb6460f3))
* **ui:** make terminal navigation responsive ([#67](https://github.com/canonical/docket/issues/67)) ([e3bd87a](https://github.com/canonical/docket/commit/e3bd87a9648f921c58c0ffdb772c39c1077e456c))

### Features

* a shared cache on disk and a refresh cycle within GitHub's budget ([#5](https://github.com/canonical/docket/issues/5)) ([a4776ff](https://github.com/canonical/docket/commit/a4776ff5cb1e2ecaab9c48a63f47d18421533a07))
* activity in the terminal, with windows, groupings and events ([#17](https://github.com/canonical/docket/issues/17)) ([8a3ac5c](https://github.com/canonical/docket/commit/8a3ac5c411dbd0411556284c3f206b49d4910829))
* add the finished mode to the terminal ([#46](https://github.com/canonical/docket/issues/46)) ([10ecbe8](https://github.com/canonical/docket/commit/10ecbe8c8394eed2ecf8c962958babdf8cebdfe9))
* answer owed, activity, show and config from the shared cache ([#7](https://github.com/canonical/docket/issues/7)) ([3072ba2](https://github.com/canonical/docket/commit/3072ba2ec1c52177c1f000e77a4ecc4ca9df6779))
* **application:** the entry prints the version, with build and check gates ([2dc89ee](https://github.com/canonical/docket/commit/2dc89ee210b03c53358affa8b9690895ad744906))
* assign and request review from the command line, plan first ([#11](https://github.com/canonical/docket/issues/11)) ([0ab00ec](https://github.com/canonical/docket/commit/0ab00ecddf6ad4581828cd9c2771c93f229face9))
* assign and request reviews from the terminal ([#20](https://github.com/canonical/docket/issues/20)) ([310b663](https://github.com/canonical/docket/commit/310b663578f2bcad98835da1ea75aea4a8301ed3))
* each repository's own settings, from its .github/docket.yaml ([#10](https://github.com/canonical/docket/issues/10)) ([9724f47](https://github.com/canonical/docket/commit/9724f47e6387cfb17ca02e80717c11808377181b))
* **inbox:** add a cached notification inbox ([#71](https://github.com/canonical/docket/issues/71)) ([fa12c6c](https://github.com/canonical/docket/commit/fa12c6c2a992445536b1298214a45d252f8a2644))
* **inbox:** show the inbox read's progress and gather a workflow's runs ([#79](https://github.com/canonical/docket/issues/79)) ([b7f8b3a](https://github.com/canonical/docket/commit/b7f8b3a0d46cd748a5b5b167dcf0e6d1f6a1354f))
* measure how threads finished and report it in text mode ([#37](https://github.com/canonical/docket/issues/37)) ([7ee8b41](https://github.com/canonical/docket/commit/7ee8b418d5a75b69e0dbe518daf5bcab0483000d))
* name the teams you belong to in docket.yaml ([#34](https://github.com/canonical/docket/issues/34)) ([2ce7125](https://github.com/canonical/docket/commit/2ce71250b6bce637d52ef709a1daea6dfc8226e1))
* owed and activity view models ([#3](https://github.com/canonical/docket/issues/3)) ([72f63d2](https://github.com/canonical/docket/commit/72f63d2cca64ec83a4049fb1dfb7c5189335f0a5))
* owed in the terminal, with rows, groupings and the accordion ([#16](https://github.com/canonical/docket/issues/16)) ([85e5c20](https://github.com/canonical/docket/commit/85e5c20e4f3e24397b413b2e175aa78607119fe1))
* page and jump through the lists, and keep list keys off under the help ([#23](https://github.com/canonical/docket/issues/23)) ([053cd72](https://github.com/canonical/docket/commit/053cd72ebfc22a7ad380f4f54fe8750f5c74aad4))
* pin group headings, sign what is below, and add the setup mode ([#36](https://github.com/canonical/docket/issues/36)) ([e984995](https://github.com/canonical/docket/commit/e984995747857106138a2e7d41ce7690f27bb13e))
* read both windowed modes' windows, on screen or not ([#65](https://github.com/canonical/docket/issues/65)) ([eec3edb](https://github.com/canonical/docket/commit/eec3edb3e6e690fde29e22585ed052c4ccf3ac3f))
* refresh by the pane's attention and read details near the cursor ([#28](https://github.com/canonical/docket/issues/28)) ([de18dff](https://github.com/canonical/docket/commit/de18dff315274325409975b1f3449c666b9355ec))
* show each repository's refresh stage and the details being read ([#33](https://github.com/canonical/docket/issues/33)) ([f200f11](https://github.com/canonical/docket/commit/f200f11d3c8035c1bdb0b66334c2a6e140c679f0))
* spend GitHub's budget by one live rule and read details on change ([#39](https://github.com/canonical/docket/issues/39)) ([2016375](https://github.com/canonical/docket/commit/201637551854d130948347c4358b323faf3c2d2d))
* text output for people and agents, safe with GitHub's text ([#6](https://github.com/canonical/docket/issues/6)) ([2fd36d6](https://github.com/canonical/docket/commit/2fd36d6a9712ad03548c178df3cf0da58c13e950))
* the provider interface and the GitHub provider ([#4](https://github.com/canonical/docket/issues/4)) ([cf83c73](https://github.com/canonical/docket/commit/cf83c7304cddfbc67e58511fc26622d1216a8feb))
* the terminal interface's frame, opened by docket in a terminal ([#12](https://github.com/canonical/docket/issues/12)) ([c86710e](https://github.com/canonical/docket/commit/c86710ede8832b936f8da55d2ca5d3df63917749))
* **ui:** draw rows and the accordion in one encoding of people and state ([#30](https://github.com/canonical/docket/issues/30)) ([426406a](https://github.com/canonical/docket/commit/426406a6970c0b2794b1b4eccd7c001d10299ac2))
* waits, people, stacks and events derived from recorded facts ([#2](https://github.com/canonical/docket/issues/2)) ([cf0b467](https://github.com/canonical/docket/commit/cf0b4676f2e5d80521b816d39317e70d9992a5de))
* who each wait is about: authors, you, and one group per login ([#26](https://github.com/canonical/docket/issues/26)) ([a5937d6](https://github.com/canonical/docket/commit/a5937d6ec2129b5b8f1e77211dd25780ee574e83))
* working time and layered configuration ([#1](https://github.com/canonical/docket/issues/1)) ([a550c79](https://github.com/canonical/docket/commit/a550c794dc1e4b8c74bbed005b6beccdb677ecc1))
