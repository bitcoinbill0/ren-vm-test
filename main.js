const Web3 = require('web3');
const RenJS = require('@renproject/ren');
const RenTx = require('@renproject/rentx');
const RenChains = require('@renproject/chains');
const HDWalletProvider = require("truffle-hdwallet-provider");
const uuid = require('uuid');
const xstate = require('xstate');

const eth_mnemonic = process.env.ETH_MNEMONIC;
const zec_address = process.env.ZEC_ADDRESS;

const ethProvider = new HDWalletProvider(eth_mnemonic, `https://mainnet.infura.io/v3/${process.env.INFURA_KEY}`, 0, 10);
const web3 = new Web3(ethProvider);

const renzec_to_zec = async () => {
  const fromChainMap = {
      ethereum: (context) => {
          const {
              destAddress,
              sourceChain,
              suggestedAmount,
              network,
          } = context.tx;
          const { providers } = context;
          return RenChains.Ethereum(providers[sourceChain], network).Account({
              address: destAddress,
              value: suggestedAmount,
          });
      }
  };
  const toChainMap = {
      zcash: (context) => RenChains.Zcash().Address(context.tx.destAddress),
  };
  const blockchainProviders = {
      ethereum: ethProvider,
  };
  const accounts = await web3.eth.getAccounts();
  const burnTransaction = {
    id: uuid.v4(),
    type: "burn",
    network: "mainnet",
    sourceAsset: "zec",
    sourceNetwork: "ethereum",
    destAddress: zec_address,
    destNetwork: "zcash",
    targetAmount: 0.2,
    userAddress: accounts[0],
    expiryTime: new Date().getTime() + 1000 * 60 * 60 * 24,
    transactions: {},
    customParams: {},
  };
  const machine = RenTx.burnMachine.withContext({
      tx: burnTransaction,
      sdk: new RenJS("testnet"),
      providers: blockchainProviders,
      autoSubmit: true,
      fromChainMap,
      toChainMap,
  });
  let shownRestore = false;
  const service = xstate.interpret(machine).onTransition((state) => {
    console.log(state.value);
    console.log(state.context.tx);
    if (!shownRestore && Object.values(state.context.tx.transactions).length) {
        console.log("Restore with", JSON.stringify(state.context.tx));
        shownRestore = true;
    }
    const burnTx = Object.values(state.context.tx.transactions || {})[0];
    if (burnTx?.destTxHash) {
        console.log("Your BTC has been released! TxHash", burnTx.destTxHash);
        service.stop();
    }
  });
  service.start();
};

renzec_to_zec();
