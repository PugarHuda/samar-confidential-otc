import { parseAbi } from "viem";

export const tokenAbi = parseAbi([
  "function mint(uint64 amount)",
  "function setOperator(address operator, uint48 until)",
  "function isOperator(address holder, address spender) view returns (bool)",
  "function confidentialBalanceOf(address account) view returns (bytes32)",
  "function name() view returns (string)",
  "function symbol() view returns (string)",
]);

export const otcAbi = parseAbi([
  "function nextId() view returns (uint256)",
  "function createIntent(address sellToken, address buyToken, bytes32 encSell, bytes32 encMinBuy, bytes proof, uint8 mode, uint64 expiresAt, address allowedTaker) returns (uint256)",
  "function grantView(uint256 id, address viewer)",
  "function acceptIntent(uint256 id, bytes32 encOffer, bytes proof)",
  "function cancelIntent(uint256 id)",
  "function submitBid(uint256 id, bytes32 encBid, bytes proof)",
  "function finalizeAuction(uint256 id)",
  "function getBidCount(uint256 id) view returns (uint256)",
  "function hasBid(uint256 id, address bidder) view returns (bool)",
  "function getIntent(uint256 id) view returns (address maker, address sellToken, address buyToken, uint8 mode, uint8 status, uint64 expiresAt, address allowedTaker)",
  "function getSellAmount(uint256 id) view returns (bytes32)",
  "function getMinBuyAmount(uint256 id) view returns (bytes32)",
  "event IntentCreated(uint256 indexed id, address indexed maker, address sellToken, address buyToken, uint8 mode, uint64 expiresAt, address allowedTaker)",
  "event IntentAccepted(uint256 indexed id, address indexed taker)",
  "event IntentCancelled(uint256 indexed id)",
  "event BidSubmitted(uint256 indexed id, address indexed bidder)",
  "event AuctionFinalized(uint256 indexed id)",
]);
