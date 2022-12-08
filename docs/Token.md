# Solidity API

## Token

### _balances

```solidity
mapping(address => uint256) _balances
```

### _allowances

```solidity
mapping(address => mapping(address => uint256)) _allowances
```

### _totalSupply

```solidity
uint256 _totalSupply
```

### _name

```solidity
string _name
```

### _version

```solidity
string _version
```

### _symbol

```solidity
string _symbol
```

### _decimals

```solidity
uint8 _decimals
```

### Transfer

```solidity
event Transfer(address from, address to, uint256 value)
```

### Approval

```solidity
event Approval(address owner, address spender, uint256 value)
```

### constructor

```solidity
constructor(string tokenName, string tokenVersion, string tokenSymbol, uint8 tokenDecimals, uint256 tokenTotalSupply) public
```

### name

```solidity
function name() external view returns (string)
```

Token name

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | string | Name |

### version

```solidity
function version() external view returns (string)
```

Token version

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | string | Version |

### symbol

```solidity
function symbol() external view returns (string)
```

Token symbol

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | string | Symbol |

### decimals

```solidity
function decimals() external view returns (uint8)
```

Number of decimal places

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint8 | Decimals |

### totalSupply

```solidity
function totalSupply() external view returns (uint256)
```

Total amount of tokens in circulation

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | Total supply |

### balanceOf

```solidity
function balanceOf(address account) external view returns (uint256)
```

Get the balance of an account

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| account | address | The account |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | Balance |

### allowance

```solidity
function allowance(address owner, address spender) external view returns (uint256)
```

Amount of remaining tokens spender is allowed to transfer on
behalf of the token owner

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| owner | address | Token owner's address |
| spender | address | Spender's address |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | Allowance amount |

### approve

```solidity
function approve(address spender, uint256 amount) external returns (bool)
```

Set spender's allowance over the caller's tokens to be a given
value

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| spender | address | Spender's address |
| amount | uint256 | Allowance amount |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | bool | True if successful |

### transferFrom

```solidity
function transferFrom(address sender, address recipient, uint256 amount) external returns (bool)
```

Transfer tokens by spending allowance

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| sender | address | Payer's address |
| recipient | address | Payee's address |
| amount | uint256 | Transfer amount |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | bool | True if successful |

### transfer

```solidity
function transfer(address recipient, uint256 amount) external returns (bool)
```

Transfer tokens from the caller

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| recipient | address | Payee's address |
| amount | uint256 | Transfer amount |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | bool | True if successful |

### increaseAllowance

```solidity
function increaseAllowance(address spender, uint256 addedValue) external returns (bool)
```

Increase the allowance by a given amount

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| spender | address | Spender's address |
| addedValue | uint256 | Amount of increase in allowance |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | bool | True if successful |

### decreaseAllowance

```solidity
function decreaseAllowance(address spender, uint256 subtractedValue) external returns (bool)
```

Decrease the allowance by a given amount

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| spender | address | Spender's address |
| subtractedValue | uint256 | Amount of decrease in allowance |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | bool | True if successful |

### _transfer

```solidity
function _transfer(address sender, address recipient, uint256 amount) internal
```

### _mint

```solidity
function _mint(address account, uint256 amount) internal
```

### _burn

```solidity
function _burn(address account, uint256 amount) internal
```

### _approve

```solidity
function _approve(address owner, address spender, uint256 amount) internal
```

### _increaseAllowance

```solidity
function _increaseAllowance(address owner, address spender, uint256 addedValue) internal
```

### _decreaseAllowance

```solidity
function _decreaseAllowance(address owner, address spender, uint256 subtractedValue) internal
```

