// SPDX-License-Identifier: MIT

pragma solidity 0.8.7;

contract Pipeline {

  enum SupportedSources {
    Ethereum,
    Polygon,
    Streamr
  }

  struct Source {
    SupportedSources sourceType;
    string sourceContractAddress;
    string eventType;
    string sourceContractABI;
  }

  mapping (address => bool) public isPipelineOwner;
  mapping (address => string) public pipelineContractAddresses;
  mapping (address => Source[]) public pipelineContractSources;
  address[] public pipelineOwnersAddresses;

  /**
   * @dev Allows the user to indicate their intention to create a pipeline,
   * more actions could be taken here like staking etc
   */
  function createPipeline() external {
    require(!isPipelineOwner[msg.sender], "You already have a pipeline created");
    isPipelineOwner[msg.sender] = true;
    pipelineOwnersAddresses.push(msg.sender);
  }

  /**
   * @dev Allows owner of the pipeline to update a JS contract.
   * @param _contractAddress The address of the JS contract.
   */
  function updatePipelineContract(string calldata _contractAddress) external {
    require(isPipelineOwner[msg.sender], "You do not have a pipeline created");
    pipelineContractAddresses[msg.sender] = _contractAddress;
  }

  /**
   * @dev Add a source to the contract
   * @param _sourceType The type of source which we want the pipeline to use
   * @param _sourceContractAddress The contract adddress of the source, it could be a streamr address, polygon contract or eth contract
   * @param _eventType the type of the event(optional)
   * @param _sourceContractABI the URL of the abi of the smart contract(optional)
   */
  function addSource(
    SupportedSources _sourceType,
    string calldata _sourceContractAddress,
    string calldata _eventType,
    string calldata _sourceContractABI
    ) external{
    Source memory newSource = Source(_sourceType, _sourceContractAddress, _eventType, _sourceContractABI );
    pipelineContractSources[msg.sender].push(newSource);
  }

  /**
   * @dev Get the total number of sources this user currently has
   */
  function getTotalSourcesCount() public view returns (uint){
    return pipelineContractSources[msg.sender].length;
  }

  /**
  * @dev get the total number of pipelines created
  */
  function getPipelinesCount() public view returns(uint){
    return pipelineOwnersAddresses.length;
  }

  /**
   * @dev Get the details of a source you have added by the index
   * @param _index The index of the source the user wants to get
   */
  function getSourceByIndex(uint _index)
  public
  view
  returns(SupportedSources, string memory, string memory, string memory){
    Source memory source = pipelineContractSources[msg.sender][_index];
    return (
      source.sourceType, source.sourceContractAddress, source.eventType, source.sourceContractABI
    );
  }
}