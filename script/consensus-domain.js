const { activateWallet } = require('@autonomys/auto-utils');
const { balance } = require('@autonomys/auto-consensus');
const { transferToDomainAccount20Type } = require('@autonomys/auto-xdm');
const fs = require('fs').promises; // 使用fs.promises支持异步文件操作

// 配置参数
const NETWORK_ID = 'taurus';                    // 测试网ID，主网用 'mainnet'
const DOMAIN_ID = '0';                            // 目标域ID（0为Auto EVM）
const TRANSFER_AMOUNT = '10000000000000000000'; // 转移10 AI3（单位Shannon）
const WALLET_FILE = './wallets-domain.json';           // 钱包信息文件路径

async function crossChainTransferForAccount(mnemonic, domainAddress, index) {
  try {
    // 激活钱包
    console.log(`账户 ${index + 1}: 连接到Consensus链...`);
    const { api, accounts } = await activateWallet({
      mnemonic: mnemonic,
      networkId: NETWORK_ID
    });
    const account = accounts[0];
    console.log(`账户 ${index + 1}: 已连接地址: ${account.address}`);

    // 查询余额
    const accountBalance = await balance(api, account.address);
    console.log(`账户 ${index + 1}: 账户余额: ${accountBalance.free}`);
    if (BigInt(accountBalance.free) < BigInt(TRANSFER_AMOUNT) + BigInt('20000000000000000')) {
      throw new Error(`账户 ${index + 1}: 余额不足，无法转移`);
    }

    // 从Consensus转移到Domain
    console.log(`账户 ${index + 1}: 开始从Consensus转移到Domain...`);
    const tx = await transferToDomainAccount20Type(
      api,
      DOMAIN_ID,
      domainAddress, // 每个账户的目标Domain地址
      TRANSFER_AMOUNT
    );

    // 等待交易包含在区块并打印哈希
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

    // 断开连接
    await api.disconnect();
    console.log(`账户 ${index + 1}: 操作完成！`);
  } catch (error) {
    console.error(`账户 ${index + 1}: 发生错误:`, error);
  }
}

async function crossChainTransferMultiple() {
  try {
    // 读取钱包信息文件
    const walletsData = await fs.readFile(WALLET_FILE, 'utf8');
    const wallets = JSON.parse(walletsData);

    // 循环处理每个账户
    for (let i = 0; i < wallets.length; i++) {
      const { mnemonic, domain_address } = wallets[i];
      await crossChainTransferForAccount(mnemonic, domain_address, i);
      console.log('------------------------');
    }
  console.log('所有账户跨链转移完成！');
  } catch (error) {
    console.error('读取文件或执行跨链失败:', error);
  } finally {
    // 强制退出进程
    process.exit(0);
  }
}

// 执行跨链转移
crossChainTransferMultiple();