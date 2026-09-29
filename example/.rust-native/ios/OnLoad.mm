#import <Foundation/Foundation.h>
#import "RustAppImpl.h"
#import <ReactCommon/CxxTurboModuleUtils.h>

@interface RustAppOnLoad : NSObject
@end

@implementation RustAppOnLoad

using namespace facebook::react;

+ (void)load
{
  registerCxxModuleToGlobalModuleMap(
    std::string(RustAppImpl::kModuleName),
    [](std::shared_ptr<CallInvoker> jsInvoker) {
      return std::make_shared<RustAppImpl>(jsInvoker);
    }
  );
}

@end
