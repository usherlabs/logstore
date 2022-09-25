// SPDX-License-Identifier: MIT

pragma solidity 0.8.7;

contract PipelineContract {
  // define global variables
  uint public totalPipelines = 0;

  // define events
  event PipelineCreated(address indexed _ownerAddress, bytes32 indexed _pipelineId);
  event PipelineModified(bytes32 indexed _pipelineId);
  event PipelineDeleted(bytes32 indexed _pipelineId);
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

  struct Pipeline {
    Source[] sources;
    string contractAddress;
    address owner;
    bool initialised;
    uint sourcesCount;
  }

  modifier onlyPipelineOwner(bytes32 _pipelineId) {
    require(pipelines[_pipelineId].owner == msg.sender, "You can only modify pipelines you created");
    _;
  }

  mapping (bytes32 => Pipeline) public pipelines;
  mapping (bytes32 => uint) private pipelineIdToIndex;
  bytes32[] public pipelineIDs;



  /**
   * @dev Allows the user to indicate their intention to create a pipeline,
   * more actions could be taken here like staking etc
   *
   * @param _jsContractAddress The address of the JS contract belonging to the pipeline.
   */
  function createPipeline(
      string calldata _jsContractAddress
    ) external {
    bytes32 _pipelineId = keccak256(abi.encodePacked(msg.sender, _jsContractAddress));
    // validate pipeline logic
    require(!pipelines[_pipelineId].initialised, "Please supply another pipelineId");
    // create pipeline logic
    Pipeline storage newPipeline = pipelines[_pipelineId];
    newPipeline.contractAddress = _jsContractAddress;
    newPipeline.owner = msg.sender;
    newPipeline.initialised = true; //add extra boolean field to enable the use of require
    newPipeline.sourcesCount = 0;

    uint pipelineCurrentIndex = pipelineIDs.length;
    // save new pipeline
    pipelines[_pipelineId] = newPipeline;
    pipelineIDs.push(_pipelineId);
    pipelineIdToIndex[_pipelineId] = pipelineCurrentIndex;
    totalPipelines++;

    // emit event
    emit PipelineCreated(msg.sender, _pipelineId);
  }


  /**
  * @dev Allows the user to fetch all pipeline keys at once,
  * this would enable the user to fetch all the keys of the pipelines
  */
  function getAllPipelineKeys() public view returns(bytes32[] memory){
    return pipelineIDs;
  }

  /**
  * @dev Adds a single source to an already created pipeline
  *
  * @param _pipelineId The id of the pipeline to be created.
  * @param _sourceType [0-2] an integer representing the type of source to be added
  * @param _sourceContractAddress an address representing the location of the source
  * @param _eventType a string representing the type of event to listen for (only compulsory for onchain events)
  * @param _sourceContractABI a representation of the ABI
  */
  function addSourceToPipeline(
      bytes32  _pipelineId,
      SupportedSources _sourceType,
      string calldata _sourceContractAddress,
      string calldata _eventType,
      string calldata _sourceContractABI
    ) public onlyPipelineOwner(_pipelineId){
    Pipeline storage existingPipeline = pipelines[_pipelineId];
    // validate pipeline logic
    require(existingPipeline.owner == msg.sender, "You can only modify pipelines created by you!");

    // create new source and add to pipeline
    Source memory newSource = Source(_sourceType, _sourceContractAddress, _eventType, _sourceContractABI );
    existingPipeline.sources.push(newSource);

    // increment pipeline sources count
    existingPipeline.sourcesCount++;

    // emit event
    emit PipelineModified(_pipelineId);
  }

  /**
  * @dev Modifies the contract associated with a pipeline
  *
  * @param _pipelineId The id of the pipeline to be created.
  * @param _newJSContract the address of pointer to the new contract
  */
  function modifyPipelineContract(
    bytes32  _pipelineId,
    string calldata _newJSContract
  ) public onlyPipelineOwner(_pipelineId){
    Pipeline storage existingPipeline = pipelines[_pipelineId];
    existingPipeline.contractAddress = _newJSContract;

    // emit event
    emit PipelineModified(_pipelineId);
  }

  /**
  * @dev Gets a single source from an already created pipeline
  *
  * @param _pipelineId The id of the pipeline to be created.
  * @param _sourceIndex an integer representing the index of the source from this pipeline we want to get
  */
  function getSingleSourceFromPipeline(
    bytes32  _pipelineId,
    uint _sourceIndex
  ) public view returns(
    SupportedSources,
    string memory,
    string memory,
    string memory
  ) {
    Pipeline memory existingPipeline = pipelines[_pipelineId];
    require(pipelines[_pipelineId].initialised, "Pipeline does'nt exist");
    Source memory existingSource = existingPipeline.sources[_sourceIndex];
    return (existingSource.sourceType, existingSource.sourceContractAddress, existingSource.eventType, existingSource.sourceContractABI);
  }

  /**
  * @dev Deletes an existing pipeline, this action can only be performed by the owner
  *
  * @param _pipelineId The id of the pipeline to be created.
  */
  function deletePipeline(
    bytes32  _pipelineId
  ) public onlyPipelineOwner(_pipelineId){
    // get the pipeline to delete
    uint pipelineIndex = pipelineIdToIndex[_pipelineId];
    // delete corresponding meta data
    delete pipelines[_pipelineId];
    delete pipelineIDs[pipelineIndex];
    delete pipelineIdToIndex[_pipelineId];

    totalPipelines--;
    //  emit the deleted event
    emit PipelineDeleted(_pipelineId);
  }

}
