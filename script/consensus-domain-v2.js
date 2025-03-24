const { ApiPromise, WsProvider } = require('@polkadot/api');
const { Keyring } = require('@polkadot/keyring');
const { balance } = require('@autonomys/auto-consensus');
const { transferToDomainAccount20Type } = require('@autonomys/auto-xdm');
const fs = require('fs').promises;

// 配置参数
const NETWORK_ID = 'taurus';
const DOMAIN_ID = '0';
const TRANSFER_AMOUNT = '3000000000000000000'; // 3 AI3
const WALLET_FILE = './wallets-domain.json';
const PRIVATE_RPC_URL = 'ws://127.0.0.1:9944'; // 你的私人RPC地址

async function crossChainTransferForAccount(mnemonic, domainAddress, index) {
  let api;
  try {
    console.log(`账户 ${index + 1}: 连接到Consensus链（私人RPC: ${PRIVATE_RPC_URL}）...`);
    // 使用WsProvider创建自定义RPC连接
    const provider = new WsProvider(PRIVATE_RPC_URL);
    api = await ApiPromise.create({ provider });

    // 使用Keyring从助记词生成账户
    const keyring = new Keyring({ type: 'sr25519' });
    const account = keyring.addFromMnemonic(mnemonic);

    console.log(`账户 ${index + 1}: 已连接到RPC: ${provider.endpoint}`); // 调试：确认RPC端点
    console.log(`账户 ${index + 1}: 已连接地址: ${account.address}`);

    const accountBalance = await balance(api, account.address);
    console.log(`账户 ${index + 1}: 账户余额: ${accountBalance.free}`);
    if (BigInt(accountBalance.free) < BigInt(TRANSFER_AMOUNT) + BigInt('20000000000000000')) {
      throw new Error(`账户 ${index + 1}: 余额不足，无法转移`);
    }

    console.log(`账户 ${index + 1}: 开始从Consensus转移到Domain...`);
    const tx = await transferToDomainAccount20Type(
      api,
      DOMAIN_ID,
      domainAddress,
      TRANSFER_AMOUNT
    );

    await new Promise((resolve, reject) => {
      tx.signAndSend(account, ({ status }) => {
        if (status.isInBlock) {
          console.log(`账户 ${index + 1}: 交易已包含在区块: ${status.asInBlock}`);
          console.log(`账户 ${index + 1}: 交易哈希: ${tx.hash.toHex()}`);
          resolve();
        }
      }).catch(error => {
        console.error(`账户 ${index + 1}: 交易提交失败:`, error);
        reject(error);
      });
    });

    await api.disconnect();
    console.log(`账户 ${index + 1}: 操作完成！`);
  } catch (error) {
    console.error(`账户 ${index + 1}: 发生错误:`, error);
  } finally {
    if (api) {
      await api.disconnect();
      console.log(`账户 ${index + 1}: API连接已断开`);
    }
  }
}

async function crossChainTransferMultiple() {
  try {
    const walletsData = await fs.readFile(WALLET_FILE, 'utf8');
    const wallets = JSON.parse(walletsData);

    for (let i = 0; i < wallets.length; i++) {
      const { mnemonic, domain_address } = wallets[i];
      await crossChainTransferForAccount(mnemonic, domain_address, i);
      console.log('------------------------');
    }
    console.log('所有账户跨链转移完成！');
  } catch (error) {
    console.error('读取文件或执行跨链失败:', error);
  } finally {
    process.exit(0);
  }
}

// 执行跨链转移
crossChainTransferMultiple();